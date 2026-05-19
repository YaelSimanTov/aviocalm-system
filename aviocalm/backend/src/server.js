 
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Database manager for saving IoT/VR data
const { insertAnxietyProfile, initializeDatabase, completeSessionWithHRV } = require('./db/dbManager');

// Device resolver for async patient-device routing (US 6.3)
const { getPatientByDevice, createNewSession, completeSession } = require('./services/device-resolver');

// Mock data simulator for centralized mock data generation
const { initializeMockSimulator, startMockSimulation, stopMockSimulation, getMockSimulationStatus } = require('./services/mockDataSimulator');

// Route imports
const authRoutes = require('./routes/auth-routes');
const ownerRoutes = require('./routes/owner-routes');
const patientsRoutes = require('./routes/patients-routes');
const analyticsRoutes = require('./routes/analytics-routes');
const inventoryRoutes = require('./routes/inventory-routes');
const assignmentRoutes = require('./routes/assignment-routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// HTTP Server & Socket.io Initialization
// ==========================================
// We wrap the Express app with a standard HTTP server to support WebSockets
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    } 
});

// ==========================================
// Middleware
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// REST API Routes
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/v1', inventoryRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
// app.use("/api/watch", watchRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        data: { 
            status: 'Server running',
            timestamp: new Date().toISOString()
        }
    });
});

// ==========================================
// VR & IoT WebSockets Logic (AvioCalm)
// ==========================================

// 1. Define Enums matching Unity's structure
const FlightState = {
    BOARDING: 'BoardingState',
    TAKE_OFF: 'TakeOffState',
    IN_FLIGHT: 'InFlightState',
    LANDING: 'LandingState',
    LANDED: 'LandedState'
};

const LevelDiff = {
    NONE: 'None',
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard'
};

// 2. Server memory for the current patient's state (Global Scope)
let currentVrState = 'Unknown'; 
let currentDifficulty = LevelDiff.NONE;

// 3. In-memory session tracker: patient_uuid -> { nationalId, sessionId }
// Used to route incoming device streams to the correct patient session
const activeSessions = new Map();

// ==========================================
// Mock Data Generator for ActiveMonitor Testing
// ==========================================

// Safety thresholds (Epic 4.1 - Safety Brakes)
const SAFETY_THRESHOLDS = {
    HR_WARNING: 100,      // Warning threshold for Heart Rate
    HR_EMERGENCY: 120,    // Emergency threshold for Heart Rate
    STRESS_EMERGENCY: 80, // Emergency threshold for Stress Score
    SPO2_MIN: 90          // Minimum acceptable SpO2 level
};

io.on('connection', async (socket) => {
    console.log(`[CONNECTION] New client connected with ID: ${socket.id}`);
    
    try {
        // Initialize database with required mock data
        await initializeDatabase();
        console.log('[INIT] Database initialization completed');
        
        // Initialize mock simulator with io instance
        initializeMockSimulator(io);
        
        // Start centralized mock data simulation
        await startMockSimulation();
    } catch (error) {
        console.error('[INIT] Database initialization failed:', error);
    }

    // Resolve device to patient via kit assignment (US 6.3)
    const deviceId = socket.handshake.query.deviceId;
    if (deviceId) {
        try {
            const deviceInfo = await getPatientByDevice(deviceId);
            if (deviceInfo) {
                // Attach patient context to this socket for use in data handlers
                socket.patientUuid = deviceInfo.patient_uuid;
                socket.nationalId = deviceInfo.national_id;
                socket.deviceType = deviceInfo.device_type;

                console.log(`[DEVICE] Device ${deviceId} (${deviceInfo.device_type}) resolved to patient: ${deviceInfo.national_id}`);

                // Create a new session if this patient does not already have one active
                if (!activeSessions.has(socket.patientUuid)) {
                    const sessionId = await createNewSession(socket.patientUuid);
                    activeSessions.set(socket.patientUuid, {
                        nationalId: deviceInfo.national_id,
                        sessionId
                    });
                    console.log(`[SESSION] New session ${sessionId} opened for patient ${deviceInfo.national_id}`);
                } else {
                    console.log(`[SESSION] Existing session found for patient ${deviceInfo.national_id}`);
                }
            } else {
                console.warn(`[Unassigned Stream] Device ${deviceId} connected without an active assignment.`);
            }
        } catch (error) {
            console.error(`[DEVICE] Error resolving device ${deviceId}:`, error);
        }
    }

    // CHANNEL 1: Listening ONLY to Unity VR
    socket.on('vr_log_message', (logMessage) => {
        // Broadcast to React FE that VR is connected
        io.emit('vr_status_change', true); 

        // Parse flight state
        if (logMessage.includes("Flight state changed to:")) {
            const extractedState = logMessage.split(": ")[1].trim();
            if (Object.values(FlightState).includes(extractedState)) {
                currentVrState = extractedState;
                console.log(`[UNITY VR] Patient transitioned to: ${currentVrState}`);
            }
        } 
        // Parse difficulty level
        else if (logMessage.includes("The Level Diffculty is")) {
            const extractedDiff = logMessage.split("is ")[1].trim();
            if (Object.values(LevelDiff).includes(extractedDiff)) {
                currentDifficulty = extractedDiff;
                console.log(`[UNITY VR] AvioCalm difficulty set to: ${currentDifficulty}`);
            }
        }
    });

    // CHANNEL 2: Listening ONLY to the Samsung Watch (IoT)
    socket.on('watch_vitals_update', async (sensorData) => {
        // Broadcast to React FE that Watch is connected
        io.emit('watch_status_change', true);

        // Evaluate distress alert based on HR threshold
        if (sensorData.heartRate > 110) {
            io.emit('distress_alert', true);
        } else {
            io.emit('distress_alert', false);
        }

        console.log(`[SAMSUNG WATCH] Raw Vitals -> HR: ${sensorData.heartRate} | Stress: ${sensorData.stressScore} | SpO2: ${sensorData.spo2}%`);

        // Skip DB insertion if this socket has no resolved patient (unassigned device)
        if (!socket.patientUuid) {
            console.warn(`[Unassigned Stream] watch_vitals_update received from unresolved socket ${socket.id} — skipping DB insert`);
            return;
        }

        // Look up the active session for this patient from the in-memory tracker
        const sessionData = activeSessions.get(socket.patientUuid);
        if (!sessionData) {
            console.warn(`[SESSION] No active session found for patient ${socket.patientUuid} — skipping DB insert`);
            return;
        }
        
        // Sync IoT Vitals with VR Context, mapping correctly to the anxiety_profiles schema:
        // patient_id = national_id (VARCHAR FK referencing patients.national_id)
        // session_id = UUID from the sessions table
        const syncedPatientRecord = {
            patientId: sessionData.nationalId,
            sessionId: sessionData.sessionId,
            timestamp: new Date().toISOString(),
            vrState: currentVrState,
            difficulty: currentDifficulty,
            vitals: {
                heartRate: sensorData.heartRate,
                stressScore: sensorData.stressScore,
                spo2: sensorData.spo2
            },
            therapistAction: 'None'
        };

        // Save directly to PostgreSQL database asynchronously
        await insertAnxietyProfile(syncedPatientRecord);
    });

    // Handle emergency stop requests from frontend
    socket.on('emergency_stop', (data) => {
        console.log(`[EMERGENCY] Manual emergency stop triggered by therapist: ${data.timestamp}`);
        io.emit('EMERGENCY_STOP', {
            timestamp: new Date().toISOString(),
            reason: 'Manual Therapist Override',
            values: { hr: currentHr, stress: currentStress }
        });
    });

    // Handle progression feedback from therapist
    socket.on('progression_feedback', (data) => {
        console.log(`[FEEDBACK] Therapist ${data.agreed ? 'agreed' : 'disagreed'} with system recommendation: ${data.timestamp}`);
        // Reset simulation for next scene
        if (data.agreed) {
            currentHr = BASELINE_HR;
            currentStress = BASELINE_STRESS;
            currentSpo2 = BASELINE_SPO2;
            simulationTime = 0;
            console.log(`[SIMULATION] Reset for next VR scene`);
        }
    });

    socket.on('disconnect', async () => {
        console.log(`[CONNECTION] Client disconnected: ${socket.id}`);

        // Complete the session when the VR device disconnects
        if (socket.deviceType === 'VR' && socket.patientUuid) {
            const sessionData = activeSessions.get(socket.patientUuid);
            if (sessionData) {
                try {
                    await completeSession(sessionData.sessionId);
                    console.log(`[SESSION] Session ${sessionData.sessionId} completed on VR disconnect for patient ${socket.nationalId}`);
                } catch (error) {
                    console.error(`[SESSION] Error completing session on disconnect:`, error);
                } finally {
                    activeSessions.delete(socket.patientUuid);
                    console.log(`[SESSION] Removed active session for patient ${socket.nationalId} from tracker`);
                }
            }
        }
    });
});

// ==========================================
// Start Server
// ==========================================
// CRITICAL: Use server.listen() instead of app.listen() to run both REST and WebSockets
server.listen(PORT, () => {
    console.log(`AvioCalm Backend Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`WebSocket Server is ready to accept connections`);
});