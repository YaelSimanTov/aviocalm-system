const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Database manager for saving IoT/VR data
const { 
    insertAnxietyProfile, 
    initializeDatabase, 
    completeSessionWithHRV,
    getPatientBaseline, 
    savePatientBaseline 
} = require('./db/db-manager');

// Device resolver for async patient-device routing (US 6.3)
const { getPatientByDevice, createNewSession, completeSession } = require('./services/device-resolver');

// Rule Engine for async alert generation (US 4.1)
const { processVitalsSample, finalizeSession } = require('./services/rule-engine');

// Mock data simulator for centralized mock data generation
const { initializeMockSimulator, startMockSimulation, stopMockSimulation } = require('./services/mock-data-simulator');

// Calibration Logic
const { processCalibration } = require('./sockets/calibrationHandler');

// Route imports
const authRoutes = require('./routes/auth-routes');
const ownerRoutes = require('./routes/owner-routes');
const patientsRoutes = require('./routes/patients-routes');
const analyticsRoutes = require('./routes/analytics-routes');
const inventoryRoutes = require('./routes/inventory-routes');
const assignmentRoutes = require('./routes/assignment-routes');
const alertsRoutes = require('./routes/alerts-routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// HTTP Server & Socket.io Initialization
// ==========================================
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"] 
    },
    allowEIO3: true,
    transports: ['websocket', 'polling']
});

// ==========================================
// Middleware & REST API Routes
// ==========================================
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/v1', inventoryRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/alerts', alertsRoutes);

app.get('/api/health', (req, res) => {
    res.json({ success: true, data: { status: 'Server running', timestamp: new Date().toISOString() } });
});

// ==========================================
// VR & IoT WebSockets Logic (AvioCalm)
// ==========================================
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

// In-memory session tracker mapping patient_uuid to their real-time clinical state
const activeSessions = new Map();

io.on('connection', async (socket) => {
    console.log(`[CONNECTION] New client connected with ID: ${socket.id}`);
    
    try {
        await initializeDatabase();
        initializeMockSimulator(io);
        await startMockSimulation(); // Can be commented out in production
    } catch (error) {
        console.error('[INIT ERROR] Database initialization failed:', error);
    }

    // Resolve device to patient via kit assignment on connection
    const deviceId = socket.handshake.query.deviceId;
    if (deviceId) {
        try {
            const deviceInfo = await getPatientByDevice(deviceId);
            if (deviceInfo) {
                socket.patientUuid = deviceInfo.patient_uuid;
                socket.nationalId = deviceInfo.national_id;
                socket.deviceType = deviceInfo.device_type;

                // Initialize a unified patient state if it doesn't exist
                if (!activeSessions.has(socket.patientUuid)) {
                    const sessionId = await createNewSession(socket.patientUuid);
                    activeSessions.set(socket.patientUuid, {
                        nationalId: deviceInfo.national_id,
                        sessionId: sessionId,
                        vrState: 'Unknown',
                        difficulty: LevelDiff.NONE,
                        latestHR: 0,
                        latestStress: 0,
                        latestSpo2: 0,
                        calibrationData: null // Null means not currently calibrating
                    });
                    console.log(`[SESSION] New session ${sessionId} opened for patient ${deviceInfo.national_id}`);
                }
            } else {
                console.warn(`[UNASSIGNED] Device ${deviceId} connected without an active assignment.`);
            }
        } catch (error) {
            console.error(`[DEVICE RESOLVER ERROR] Failed resolving device ${deviceId}:`, error);
        }
    }

    // ==========================================
    // CHANNEL 1: Unity VR Logs
    // ==========================================
    socket.on('vr_system_log', (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const logMessage = payload.content || payload;
            
            io.emit('vr_status_change', true); 

            if (!socket.patientUuid || !activeSessions.has(socket.patientUuid)) return;
            const sessionData = activeSessions.get(socket.patientUuid);

            // Parse flight state and update specific patient's memory
            if (logMessage.includes("Flight state changed to:")) {
                const extractedState = logMessage.split(": ")[1].trim();
                if (Object.values(FlightState).includes(extractedState)) {
                    sessionData.vrState = extractedState;
                    console.log(`[UNITY VR | ${sessionData.nationalId}] State transitioned to: ${extractedState}`);
                }
            } 
            // Parse difficulty level
            else if (logMessage.includes("The Level Diffculty is")) {
                const extractedDiff = logMessage.split("is ")[1].trim();
                if (Object.values(LevelDiff).includes(extractedDiff)) {
                    sessionData.difficulty = extractedDiff;
                    console.log(`[UNITY VR | ${sessionData.nationalId}] Difficulty set to: ${extractedDiff}`);
                }
            }
        } catch (err) {
            console.error(`[VR LOG ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 2: Samsung Watch Vitals
    // ==========================================
    socket.on('watch_vitals_update', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            
            // Extract inner content mapped from Android app
            const sensorData = typeof payload.content === 'string' ? JSON.parse(payload.content) : payload;
            
            io.emit('watch_status_change', true);

            if (!socket.patientUuid || !activeSessions.has(socket.patientUuid)) return;
            const sessionData = activeSessions.get(socket.patientUuid);

            // Update latest clinical metrics in memory
            sessionData.latestHR = sensorData.hr || sensorData.heartRate;
            sessionData.latestSpo2 = sensorData.spo2;
            sessionData.latestStress = sensorData.stressScore || 0;

            // Collect HR if calibration is currently active
            if (sessionData.calibrationData !== null && sessionData.latestHR > 0) {
                sessionData.calibrationData.push(sessionData.latestHR);
            }

            // Emit distress alert
            io.emit('distress_alert', sessionData.latestHR > 110);

            // Sync IoT Vitals with VR Context and save to DB
            const syncedPatientRecord = {
                patientId: sessionData.nationalId,
                sessionId: sessionData.sessionId,
                timestamp: new Date().toISOString(),
                vrState: sessionData.vrState,
                difficulty: sessionData.difficulty,
                vitals: {
                    heartRate: sessionData.latestHR,
                    stressScore: sessionData.latestStress,
                    spo2: sessionData.latestSpo2
                },
                therapistAction: 'None'
            };

            await insertAnxietyProfile(syncedPatientRecord);

            await processVitalsSample({
                sessionId: sessionData.sessionId,
                patientUuid: socket.patientUuid,
                timestamp: syncedPatientRecord.timestamp,
                heartRate: sessionData.latestHR,
                stressScore: sessionData.latestStress,
                spo2: sessionData.latestSpo2,
            });
        } catch (err) {
            console.error(`[VITALS ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 3: VR Calibration Flow
    // ==========================================
    socket.on('CALIBRATION_START', async (data) => {
        try {
            if (!socket.patientUuid || !activeSessions.has(socket.patientUuid)) return;
            const sessionData = activeSessions.get(socket.patientUuid);

            console.log(`[CALIBRATION] Starting for patient: ${sessionData.nationalId}`);
            
            // Initialize array to start collecting HR samples
            sessionData.calibrationData = [];

            const historicalBaseline = await getPatientBaseline(socket.patientUuid) || 72;
            const startingHR = sessionData.latestHR || 0; 
            
            const response = processCalibration(startingHR, historicalBaseline);
            socket.emit(response.event, response.payload);
        } catch (err) {
            console.error(`[CALIBRATION START ERROR] ${err.message}`);
        }
    });

    socket.on('CALIBRATION_END', async (data) => {
        try {
            if (!socket.patientUuid || !activeSessions.has(socket.patientUuid)) return;
            const sessionData = activeSessions.get(socket.patientUuid);
            const hrArray = sessionData.calibrationData;

            if (hrArray && hrArray.length > 0) {
                const sum = hrArray.reduce((a, b) => a + b, 0);
                const avgBaseline = Math.round(sum / hrArray.length);
                
                console.log(`[CALIBRATION] Complete. Saving avg HR: ${avgBaseline} for patient: ${sessionData.nationalId}`);
                await savePatientBaseline(socket.patientUuid, sessionData.sessionId, avgBaseline);
            } else {
                console.log(`[CALIBRATION] Complete, but no HR data collected for patient: ${sessionData.nationalId}`);
            }

            // Close calibration window
            sessionData.calibrationData = null;
        } catch (err) {
            console.error(`[CALIBRATION END ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 4: Therapist Controls
    // ==========================================
    socket.on('emergency_stop', (data) => {
        const sessionData = activeSessions.get(socket.patientUuid);
        const hr = sessionData ? sessionData.latestHR : 0;
        const stress = sessionData ? sessionData.latestStress : 0;

        console.log(`[EMERGENCY] Manual emergency stop triggered. Timestamp: ${data.timestamp}`);
        io.emit('EMERGENCY_STOP', {
            timestamp: new Date().toISOString(),
            reason: 'Manual Therapist Override',
            values: { hr: hr, stress: stress }
        });
    });

    // ==========================================
    // Disconnect Handling
    // ==========================================
    socket.on('disconnect', async () => {
        console.log(`[CONNECTION] Client disconnected: ${socket.id}`);

        if (socket.deviceType === 'VR' && socket.patientUuid) {
            const sessionData = activeSessions.get(socket.patientUuid);
            if (sessionData) {
                try {
                    await finalizeSession(sessionData.sessionId);
                    await completeSession(sessionData.sessionId);
                    console.log(`[SESSION] Session ${sessionData.sessionId} completed for patient ${socket.nationalId}`);
                } catch (error) {
                    console.error(`[SESSION ERROR] Error completing session:`, error);
                } finally {
                    activeSessions.delete(socket.patientUuid);
                }
            }
        }
    });
});

// ==========================================
// Start Server
// ==========================================
server.listen(PORT, () => {
    console.log(`AvioCalm Backend Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`WebSocket Server is ready to accept hardware connections`);
});