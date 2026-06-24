const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Import database manager functions
const { 
    insertAnxietyProfile, 
    getActivePatientByDevice, 
    getPatientBaseline, 
    savePatientBaseline, 
    createNewSession, 
    endSession 
} = require('./db/db-manager');

// Import the calibration logic
const { processCalibration } = require('./sockets/calibrationHandler');

const app = express();
const server = http.createServer(app);

// Configure Server with transports for Unity and Android compatibility
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] },
    allowEIO3: true,
    transports: ['websocket', 'polling']
});

const FlightState = { BOARDING: 'BoardingState', TAKE_OFF: 'TakeOffState', IN_FLIGHT: 'InFlightState', LANDING: 'LandingState', LANDED: 'LandedState' };
const LevelDiff = { NONE: 'None', EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

let currentVrState = 'Unknown'; 
let currentDifficulty = LevelDiff.NONE;

// Multi-patient state management
const latestPatientHR = {}; 
const activeCalibrations = {}; 
const activeSessions = {}; 

io.on('connection', (socket) => {
    console.log(`[CONNECTION] New client connected with ID: ${socket.id}`);

    // ==========================================
    // CHANNEL 0: Headset Lifecycle Management
    // ==========================================
    socket.on('SESSION_START', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const patientId = await getActivePatientByDevice(payload.deviceId);
            if (!patientId) return;

            const newSessionId = await createNewSession(patientId);
            activeSessions[patientId] = newSessionId;
            console.log(`[SESSION] Started session ${newSessionId} for patient ${patientId}`);
        } catch (err) {
            console.error(`[SESSION START ERROR] ${err.message}`);
        }
    });

    socket.on('SESSION_END', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const patientId = await getActivePatientByDevice(payload.deviceId);
            if (!patientId) return;

            const currentSessionId = activeSessions[patientId];
            if (currentSessionId) {
                await endSession(currentSessionId);
                console.log(`[SESSION] Ended session ${currentSessionId} for patient ${patientId}`);
                delete activeSessions[patientId];
                delete latestPatientHR[patientId];
            }
        } catch (err) {
            console.error(`[SESSION END ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 1: Unity Logs
    // ==========================================
    socket.on('vr_system_log', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceId = payload.deviceId;
            const logMessage = payload.content;

            if (!deviceId || !logMessage) return;

            const patientId = await getActivePatientByDevice(deviceId);
            if (!patientId) {
                console.log(`[UNASSIGNED VR LOG] Device ${deviceId}: ${logMessage}`);
                return;
            }

            console.log(`[VR LOG | Patient: ${patientId}] ${logMessage}`);

            if (logMessage.includes("Flight state changed to:")) {
                const extractedState = logMessage.split(": ")[1].trim();
                if (Object.values(FlightState).includes(extractedState)) {
                    currentVrState = extractedState;
                }
            } 
            else if (logMessage.includes("The Level Diffculty is")) {
                const extractedDiff = logMessage.split("is ")[1].trim();
                if (Object.values(LevelDiff).includes(extractedDiff)) {
                    currentDifficulty = extractedDiff;
                }
            }
        } catch (err) {
            console.error(`[LOG ERROR] Parsing or handling log failed: ${err.message}`);
        }
    });
     
    // ==========================================
    // CHANNEL 2: Samsung Watch Vitals (Merged Logic)
    // ==========================================
    socket.on('watch_vitals_update', async (data) => {
        try {
            // Support both string and object payloads securely
            let sensorData = data;
            if (typeof data === 'string') {
                sensorData = JSON.parse(data);
            }

            // Extract normalized fields based on the new Android format
            const deviceId = sensorData.deviceId || 'Missing';
            if (deviceId === 'Missing') {
                console.log(`[VITALS ERROR] Payload is missing 'deviceId'. Dropping packet.`);
                return;
            }

            const vitals = sensorData.vitals || {};
            const heartRate = vitals.heartRate ?? sensorData.heartRate ?? 0;
            const spo2 = vitals.spo2 ?? sensorData.spo2;
            const stressScore = vitals.stressScore ?? sensorData.stressScore;
            const ibiData = vitals.ibiData || sensorData.ibiData || [];

            console.log(`\n--- [NEW VITALS PACKET] Received from ${socket.id} ---`);
            console.log(`Device ID:  ${deviceId}`);
            console.log(`Heart Rate: ${heartRate} BPM`);
            console.log(`SpO2:       ${spo2 !== undefined ? spo2 + '%' : 'N/A'}`);
            console.log(`----------------------------------------------------`);

            // Example high HR alert logic
            if (heartRate > 110) {
                console.log(`[ALERT] HIGH HEART RATE DETECTED: ${heartRate}`);
            }

            // Map device to an active patient
            const patientId = await getActivePatientByDevice(deviceId);
            if (!patientId) {
                console.log(`[VITALS ERROR] No active patient found for deviceId: ${deviceId}.`);
                return;
            }

            // Update state for calibration
            latestPatientHR[patientId] = heartRate;
            if (activeCalibrations[patientId] !== undefined && heartRate > 0) {
                activeCalibrations[patientId].push(heartRate);
            }

            // Save telemetry data to DB if a session is active
            const currentSessionId = activeSessions[patientId];
            if (currentSessionId) {
                const syncedPatientRecord = {
                    patientId: patientId, 
                    sessionId: currentSessionId, 
                    timestamp: new Date().toISOString(),
                    vrState: currentVrState,
                    difficulty: currentDifficulty,
                    vitals: { heartRate: heartRate, stressScore: stressScore, spo2: spo2 },
                    therapistAction: 'None'
                };

                await insertAnxietyProfile(syncedPatientRecord);
                console.log(`[DB] Vitals seamlessly saved for session ${currentSessionId}`);
            }
        } catch (err) {
            console.error(`[VITALS PARSING ERROR] Failed to process watch data: ${err.message}`);
        }
    });
    
    // ==========================================
    // CHANNEL 3: VR Calibration Flow (START)
    // ==========================================
    socket.on('CALIBRATION_START', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceId = payload.deviceId;

            const patientId = await getActivePatientByDevice(deviceId);
            if (!patientId) {
                console.log(`[CALIBRATION] Device ${deviceId} has no active patient assignment.`);
                return;
            }

            console.log(`[CALIBRATION] Starting for patient: ${patientId}`);
            activeCalibrations[patientId] = [];

            const historicalBaseline = await getPatientBaseline(patientId) || 72;
            const startingHR = latestPatientHR[patientId] || 0; 
            
            const response = processCalibration(startingHR, historicalBaseline);
            socket.emit(response.event, response.payload);
        } catch (err) {
            console.error(`[CALIBRATION START ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 4: Calibration Completion (END)
    // ==========================================
    socket.on('CALIBRATION_END', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceId = payload.deviceId;

            const patientId = await getActivePatientByDevice(deviceId);
            if (!patientId) return;

            const hrArray = activeCalibrations[patientId];
            const currentSessionId = activeSessions[patientId] || null;

            if (hrArray && hrArray.length > 0) {
                const sum = hrArray.reduce((a, b) => a + b, 0);
                const avgBaseline = Math.round(sum / hrArray.length);
                
                console.log(`[CALIBRATION] Complete. Saving avg HR: ${avgBaseline} for patient: ${patientId}`);
                await savePatientBaseline(patientId, currentSessionId, avgBaseline);
            } else {
                console.log(`[CALIBRATION] Complete, but no data collected for patient: ${patientId}`);
            }

            delete activeCalibrations[patientId];
        } catch (err) {
            console.error(`[CALIBRATION END ERROR] ${err.message}`);
        }
    });

    socket.on('disconnect', () => { 
        console.log(`[CONNECTION] Client disconnected: ${socket.id}`); 
    });
});
   
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => { 
    console.log(`Unified VR & Watch Server is running on port ${PORT}`); 
});