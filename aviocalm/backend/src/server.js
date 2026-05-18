 
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Database manager for saving IoT/VR data
const { insertAnxietyProfile, initializeDatabase } = require('./db/dbManager');

// Mock data simulator for centralized mock data generation
const { initializeMockSimulator, startMockSimulation, stopMockSimulation, getMockSimulationStatus } = require('./services/mockDataSimulator');

// Route imports
const authRoutes = require('./routes/auth-routes');
const ownerRoutes = require('./routes/owner-routes');
const patientsRoutes = require('./routes/patients-routes');
const analyticsRoutes = require('./routes/analytics-routes');
const inventoryRoutes = require('./routes/inventory-routes');

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
        
        // Sync IoT Vitals with VR Context
        const syncedPatientRecord = {
            sessionId: '123e4567-e89b-12d3-a456-426614174000', // To be replaced dynamically later
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

    socket.on('disconnect', () => {
        console.log(`[CONNECTION] Client disconnected: ${socket.id}`);
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