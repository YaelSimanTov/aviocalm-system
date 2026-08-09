 
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Database manager for saving IoT/VR data
const { insertAnxietyProfile, initializeDatabase, completeSessionWithHRV, getPatientBaseline, savePatientBaseline, createNewSession, updateDeviceLastSeen, insertVrEvent, getActiveSessionForPatient } = require('./db/db-manager');

// Calibration logic for VR headset pre-flight sync
const { processCalibration } = require('./sockets/calibrationHandler');

// Device resolver for async patient-device routing (US 6.3)
const { getPatientByDevice, completeSession } = require('./services/device-resolver');

// Rule Engine for async alert generation (US 4.1)
const { processVitalsSample, finalizeSession } = require('./services/rule-engine');

// HRV-based stress calculator for smartwatch IBI streams
const { calculateStressFromIBI } = require('./services/hrv-calculator');

// Mock data simulator for centralized mock data generation
// const { initializeMockSimulator, startMockSimulation, stopMockSimulation, getMockSimulationStatus } = require('./services/mock-data-simulator');

// Route imports
const authRoutes = require('./routes/auth-routes');
const ownerRoutes = require('./routes/owner-routes');
const patientsRoutes = require('./routes/patients-routes');
const analyticsRoutes = require('./routes/analytics-routes');
const inventoryRoutes = require('./routes/inventory-routes');
const assignmentRoutes = require('./routes/assignment-routes');
const alertsRoutes     = require('./routes/alerts-routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// HTTP Server & Socket.io Initialization
// ==========================================
// We wrap the Express app with a standard HTTP server to support WebSockets
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*", methods: ["GET", "POST"] },
    allowEIO3: true,                          // Unity Socket.IO v3 compatibility
    transports: ['websocket', 'polling']      // Support both Unity and browser clients
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
app.use('/api/alerts',        alertsRoutes);
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

// Dynamic vitals offsets keyed by Unity VR flight-phase enum name.
// Applied to raw smartwatch readings before persistence and rule-engine
// processing so all alert types (Statistical, Panic, Safety) trigger and
// resolve naturally during a full live simulation with real hardware.
// Preparation / default: zero offsets → lets the rule engine build a true baseline.
const VR_PHASE_OFFSETS = {
    'Preparation':   { offsetHR: 0,  offsetSpO2: 0,   fixedStress: null },
    'BoardingState': { offsetHR: 25, offsetSpO2: -2,  fixedStress: 50   },
    'TakeOffState':  { offsetHR: 55, offsetSpO2: -5,  fixedStress: 85   },
    'InFlightState': { offsetHR: 10, offsetSpO2: 0,   fixedStress: 35   },
    'LandingState':  { offsetHR: 80, offsetSpO2: -12, fixedStress: 98   },
    'LandedState':   { offsetHR: 5,  offsetSpO2: 0,   fixedStress: 25   },
};

// 2. Server memory for the current patient's state (Global Scope)
let currentVrState = 'Unknown'; 
let currentDifficulty = LevelDiff.NONE;

// 3. In-memory session tracker: patient_uuid -> { nationalId, sessionId }
// Used to route incoming device streams to the correct patient session
const activeSessions = {};

// Dual-device waiting room: patientId -> { vrReady, watchReady, vrDeviceId, watchDeviceId, vrSocketId, watchSocketId, nationalId }
// A session is only created once BOTH the VR headset AND the Watch are confirmed connected for the same patient.
const pendingSessions = {};

// 3b. Per-session VR state tracker: sessionId -> { state, difficulty }
// Kept in sync by vr_system_log; consumed by watch_vitals_update for anxiety_profiles
const sessionVrState = {};

// In-memory throttle map: deviceId -> last DB write timestamp (ms)
// Limits last_seen DB updates to once per 30 seconds per device so high-frequency
// socket events (watch_vitals_update, vr_system_log) do not spam the database.
const lastSeenThrottle = {};
const LAST_SEEN_THROTTLE_MS = 30 * 1000;

/**
 * Writes the current timestamp to devices.last_seen for the given device,
 * but at most once every LAST_SEEN_THROTTLE_MS milliseconds.
 * Fire-and-forget — errors are logged but never propagated to the caller.
 * @param {string} deviceId
 */
async function throttledUpdateLastSeen(deviceId) {
    const now = Date.now();
    if (lastSeenThrottle[deviceId] && now - lastSeenThrottle[deviceId] < LAST_SEEN_THROTTLE_MS) {
        return; // Skip — already updated within the throttle window
    }
    lastSeenThrottle[deviceId] = now;
    try {
        await updateDeviceLastSeen(deviceId);
    } catch (err) {
        console.error(`[LAST_SEEN] Failed to update device ${deviceId}: ${err.message}`);
    }
}

/**
 * Dual-device session gate: creates a DB session only when BOTH VR and Watch
 * are confirmed connected for the same patient.
 * Reads pendingSessions[patientId]; if vrReady AND watchReady are both true,
 * calls createNewSession, populates activeSessions, and removes the pending slot.
 * @param {string} patientId  - The patient UUID
 * @param {string} nationalId - The patient national ID
 * @returns {Promise<void>}
 */
async function tryInitiateSession(patientId, nationalId) {
    const pending = pendingSessions[patientId];
    if (!pending || !pending.vrReady || !pending.watchReady) {
        return; // Both devices not yet connected — keep waiting
    }

    // Guard: prevent double-creation if a concurrent call already created the session
    if (activeSessions[patientId]) {
        delete pendingSessions[patientId];
        return;
    }

    console.log(`[DUAL-DEVICE] Both VR and Watch confirmed for patient ${nationalId} — initiating session`);

    // Capture VR socket ID before clearing the pending slot
    const vrSocketId = pending.vrSocketId;

    try {
        const newSessionId = await createNewSession(patientId);
        activeSessions[patientId] = { nationalId, sessionId: newSessionId };
        console.log(`[SESSION] Created session ${newSessionId} for patient ${nationalId} (dual-device confirmed)`);
    } catch (err) {
        console.error(`[DUAL-DEVICE] Failed to create session for patient ${nationalId}: ${err.message}`);
        return;
    }

    // Clear the pending slot now that the session is active
    delete pendingSessions[patientId];

    // Both devices are now confirmed — push CALIBRATION_SETUP directly to the waiting VR headset
    // so Unity is unblocked without needing to re-emit CALIBRATION_START
    if (vrSocketId) {
        try {
            const startingHR = latestPatientHR[patientId] || 0;
            const historicalBaseline = await getPatientBaseline(patientId) || 72;
            const response = processCalibration(startingHR, historicalBaseline);
            if (response.event === 'CALIBRATION_SETUP') {
                io.to(vrSocketId).emit(response.event, response.payload);
                console.log(`[CALIBRATION] Auto-pushed CALIBRATION_SETUP to VR socket ${vrSocketId} for patient ${nationalId} (durationSeconds=${response.payload.durationSeconds})`);
            }
        } catch (calErr) {
            console.error(`[CALIBRATION] Failed to auto-push CALIBRATION_SETUP for patient ${nationalId}: ${calErr.message}`);
        }
    }
}

/**
 * Registers the VR device as ready in pendingSessions if it has not been marked yet,
 * then calls tryInitiateSession. Used as a fallback for Unity clients that do not
 * emit SESSION_START and instead signal readiness via CALIBRATION_START or vr_system_log.
 * No-op when the session is already active or VR is already marked ready.
 * @param {object} socket     - The Socket.io socket for this connection
 * @param {string} patientId  - The patient UUID
 * @param {string} deviceId   - The VR device ID
 * @param {string} nationalId - The patient national ID
 * @returns {Promise<void>}
 */
async function markVrReadyIfPending(socket, patientId, deviceId, nationalId) {
    // Session already active — nothing to do
    if (activeSessions[patientId]) return;

    // VR already registered — skip to avoid re-entrancy
    if (pendingSessions[patientId]?.vrReady) return;

    // Bind socket metadata so the disconnect handler can identify this socket
    if (!socket.patientUuid) {
        socket.deviceId    = deviceId;
        socket.patientUuid = patientId;
        socket.nationalId  = nationalId;
        socket.deviceType  = 'VR';
    }

    if (!pendingSessions[patientId]) {
        pendingSessions[patientId] = {
            vrReady: false, watchReady: false,
            vrDeviceId: null, watchDeviceId: null,
            vrSocketId: null, watchSocketId: null,
            nationalId
        };
    }
    pendingSessions[patientId].vrReady    = true;
    pendingSessions[patientId].vrDeviceId = deviceId;
    pendingSessions[patientId].vrSocketId = socket.id;
    pendingSessions[patientId].nationalId = nationalId;
    console.log(`[DUAL-DEVICE] VR device ${deviceId} marked ready (fallback) for patient ${nationalId} — waiting for Watch`);

    await tryInitiateSession(patientId, nationalId);
}

// 4. Calibration accumulators: patient_uuid -> HR sample array
// Populated by watch_vitals_update while a calibration window is open
const activeCalibrations = {};

// 5. Latest HR cache: patient_uuid -> most recent heart rate (BPM)
// Used to seed CALIBRATION_START before the first watch packet arrives
const latestPatientHR = {};

// ==========================================
// Development / Testing: VR Bypass Endpoint
// ==========================================
// POST /api/debug/vr-ready
// Marks the VR side as ready in the dual-device waiting room WITHOUT a physical
// VR headset being connected. This unblocks calibration when testing watch-only.
// ONLY active when BYPASS_VR_REQUIREMENT=true is set in .env.
// Usage:  POST http://localhost:<PORT>/api/debug/vr-ready
//         Body: { "nationalId": "325181295" }
app.post('/api/debug/vr-ready', async (req, res) => {
    if (process.env.BYPASS_VR_REQUIREMENT !== 'true') {
        return res.status(403).json({
            success: false,
            error: 'VR bypass is disabled. Add BYPASS_VR_REQUIREMENT=true to .env to enable this endpoint.'
        });
    }

    const { nationalId } = req.body;
    if (!nationalId) {
        return res.status(400).json({ success: false, error: 'nationalId is required in the request body.' });
    }

    // Check if a session is already active for this patient (nothing to bypass)
    const activeKey = Object.keys(activeSessions).find(
        k => String(activeSessions[k].nationalId) === String(nationalId)
    );
    if (activeKey) {
        return res.json({
            success: true,
            message: `Session already active for patient ${nationalId}.`,
            sessionId: activeSessions[activeKey].sessionId
        });
    }

    // Find the pending slot for this patient by nationalId
    const patientId = Object.keys(pendingSessions).find(
        k => String(pendingSessions[k].nationalId) === String(nationalId)
    );

    if (!patientId) {
        return res.status(404).json({
            success: false,
            error: `No pending session found for patient ${nationalId}. Ensure the watch is connected and sending vitals first.`
        });
    }

    // Inject VR-ready flag with no physical socket (bypass mode).
    // vrSocketId is intentionally null — tryInitiateSession will skip the
    // CALIBRATION_SETUP auto-push (guarded by `if (vrSocketId)`), but the
    // DB session is created and watch vitals start being persisted normally.
    pendingSessions[patientId].vrReady    = true;
    pendingSessions[patientId].vrDeviceId = 'bypass-no-vr';
    pendingSessions[patientId].vrSocketId = null;
    console.log(`[DUAL-DEVICE][BYPASS] VR marked ready (no headset) for patient ${nationalId} via debug endpoint`);

    await tryInitiateSession(patientId, String(nationalId));

    if (activeSessions[patientId]) {
        return res.json({
            success: true,
            message: `Session created for patient ${nationalId}. Watch vitals will now be persisted to the DB.`,
            sessionId: activeSessions[patientId].sessionId
        });
    }

    return res.status(500).json({
        success: false,
        error: 'tryInitiateSession ran but no session was created. Check server logs for DB errors.'
    });
});

// ==========================================
// Mock Data Generator for ActiveMonitor Testing
// ==========================================

// Safety thresholds (Epic 4.1 - Safety Brakes)
// const SAFETY_THRESHOLDS = {
//     HR_WARNING: 100,      // Warning threshold for Heart Rate
//     HR_EMERGENCY: 120,    // Emergency threshold for Heart Rate
//     STRESS_EMERGENCY: 80, // Emergency threshold for Stress Score
//     SPO2_MIN: 90          // Minimum acceptable SpO2 level
// };

io.on('connection', (socket) => {
    console.log(`[CONNECTION] New client connected with ID: ${socket.id}`);

    // ==========================================
    // CHANNEL 0: VR Headset Lifecycle Events
    // ==========================================

    socket.on('SESSION_START', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceInfo = await getPatientByDevice(payload.deviceId);
            const patientId = deviceInfo ? deviceInfo.patient_uuid : null;
            if (!patientId) {
                console.error(`[SESSION START] Device ${payload.deviceId} is not assigned to any patient — rejecting SESSION_START`);
                socket.emit('SESSION_ERROR', { code: 'DEVICE_UNASSIGNED', message: `Device ${payload.deviceId} is not assigned to any patient.` });
                return;
            }

            // Bind socket metadata now so the disconnect handler can identify this socket
            socket.deviceId    = payload.deviceId;
            socket.patientUuid = patientId;
            socket.nationalId  = deviceInfo.national_id;
            socket.deviceType  = 'VR';

            // If a full session is already active (Watch connected first), nothing more to do
            if (activeSessions[patientId]) {
                console.log(`[DUAL-DEVICE] VR connected but session already active for patient ${deviceInfo.national_id}`);
                return;
            }

            // Register VR in the dual-device waiting room
            if (!pendingSessions[patientId]) {
                pendingSessions[patientId] = {
                    vrReady: false, watchReady: false,
                    vrDeviceId: null, watchDeviceId: null,
                    vrSocketId: null, watchSocketId: null,
                    nationalId: deviceInfo.national_id
                };
            }
            pendingSessions[patientId].vrReady    = true;
            pendingSessions[patientId].vrDeviceId = payload.deviceId;
            pendingSessions[patientId].vrSocketId = socket.id;
            pendingSessions[patientId].nationalId = deviceInfo.national_id;
            console.log(`[DUAL-DEVICE] VR device ${payload.deviceId} ready for patient ${deviceInfo.national_id} — waiting for Watch`);

            await tryInitiateSession(patientId, deviceInfo.national_id);

            // Emit feedback if session was not yet created because watch is not connected
            if (!activeSessions[patientId]) {
                console.log(`[SESSION START] VR ready, waiting for Watch for patient ${deviceInfo.national_id}...`);
                socket.emit('SESSION_WAITING', {
                    status: 'waiting',
                    message: 'VR headset registered. Waiting for smartwatch to connect before starting session.'
                });
            }
        } catch (err) {
            console.error(`[SESSION START ERROR] ${err.message}`);
        }
    });

    socket.on('SESSION_END', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceInfo = await getPatientByDevice(payload.deviceId);
            const patientId = deviceInfo ? deviceInfo.patient_uuid : null;
            if (!patientId) return;

            const currentSessionId = activeSessions[patientId]?.sessionId;
            if (currentSessionId) {
                await finalizeSession(currentSessionId);
                await completeSession(currentSessionId);
                // Update last_seen for this device in the devices table
                try {
                    await updateDeviceLastSeen(payload.deviceId);
                } catch (lsErr) {
                    console.error(`[SESSION END] Failed to update last_seen for device ${payload.deviceId}: ${lsErr.message}`);
                }
                console.log(`[SESSION] Ended session ${currentSessionId} for patient ${patientId}`);
                delete activeSessions[patientId];
                delete latestPatientHR[patientId];
                delete activeCalibrations[patientId];
            }
        } catch (err) {
            console.error(`[SESSION END ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 1: Listening ONLY to Unity VR
    // ==========================================

    socket.on('vr_system_log', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceId = payload.deviceId;
            const logMessage = payload.content;

            if (!deviceId || !logMessage) return;

            const deviceInfo = await getPatientByDevice(deviceId);
            const patientId = deviceInfo ? deviceInfo.patient_uuid : null;

            if (!patientId) {
                console.log(`[UNASSIGNED VR LOG] Device ${deviceId}: ${logMessage}`);
                return;
            }

            // Fallback VR-ready registration for Unity clients that skip SESSION_START
            await markVrReadyIfPending(socket, patientId, deviceId, deviceInfo.national_id);

            // Update last_seen for this VR device (throttled to once per 30 seconds)
            throttledUpdateLastSeen(deviceId);

            io.emit('vr_status_change', true);
            console.log(`[VR LOG | Patient: ${patientId}] ${logMessage}`);

            // Extract the Unity tag (e.g. '[User Action]') and the message body
            const TAG_PATTERN = /^(\[[^\]]+\])\s*(.*)/s;
            const tagMatch = logMessage.match(TAG_PATTERN);
            const vrTag     = tagMatch ? tagMatch[1] : '[Unknown]';
            const vrMessage = tagMatch ? tagMatch[2].trim() : logMessage;

            // Persist the event — try in-memory session map first, then fall back to DB
            const sessionId = activeSessions[patientId]?.sessionId
                ?? await getActiveSessionForPatient(patientId);
            if (sessionId) {
                try {
                    await insertVrEvent(sessionId, vrTag, vrMessage, new Date().toISOString());
                } catch (dbErr) {
                    console.error('[VR LOG] Failed to persist event for session ' + sessionId + ': ' + dbErr.message);
                }
            }

            // Keep per-session VR state in sync for biometric pairing
            if (sessionId) {
                if (!sessionVrState[sessionId]) {
                    sessionVrState[sessionId] = { state: 'Preparation', difficulty: LevelDiff.NONE };
                }
                if (vrTag === '[Flight Phase]' && vrMessage.includes('Phase changed to:')) {
                    const extractedState = vrMessage.split('Phase changed to:')[1].trim().split(/\s+/)[0];
                    if (Object.values(FlightState).includes(extractedState)) {
                        sessionVrState[sessionId].state = extractedState;
                    }
                } else if (vrTag === '[System Event]' && vrMessage.includes('Difficulty Level:')) {
                    const extractedDiff = vrMessage.split('Difficulty Level:')[1].trim().split(/\s+/)[0];
                    if (Object.values(LevelDiff).includes(extractedDiff)) {
                        sessionVrState[sessionId].difficulty = extractedDiff;
                    }
                }
            }
        } catch (err) {
            console.error(`[LOG ERROR] ${err.message}`);
        }
    });

    // ==========================================
    // CHANNEL 3: VR Calibration Flow
    // ==========================================

    socket.on('CALIBRATION_START', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceInfo = await getPatientByDevice(payload.deviceId);
            const patientId = deviceInfo ? deviceInfo.patient_uuid : null;

            if (!patientId) {
                console.log(`[CALIBRATION] Device ${payload.deviceId} has no active patient assignment.`);
                return;
            }

            // Fallback VR-ready registration for Unity clients that skip SESSION_START
            await markVrReadyIfPending(socket, patientId, payload.deviceId, deviceInfo.national_id);

            // Guard: calibration MUST NOT start unless the watch is connected AND has sent HR data
            const watchConnected = pendingSessions[patientId]?.watchReady || !!activeSessions[patientId];
            const startingHR = latestPatientHR[patientId] || 0;
            if (!watchConnected || startingHR === 0) {
                console.log(`[CALIBRATION] Watch not ready or no HR data for patient ${deviceInfo.national_id} — emitting WAITING_FOR_WATCH (watchConnected=${watchConnected}, HR=${startingHR})`);
                socket.emit('WAITING_FOR_WATCH', {
                    status: 'waiting',
                    message: 'Watch not connected or no heart rate data received yet. Please ensure the smartwatch is worn and connected.'
                });
                return;
            }

            console.log(`[CALIBRATION] Starting for patient: ${patientId}`);
            activeCalibrations[patientId] = [];

            const historicalBaseline = await getPatientBaseline(patientId) || 72;
            const response = processCalibration(startingHR, historicalBaseline);
            socket.emit(response.event, response.payload);
        } catch (err) {
            console.error(`[CALIBRATION START ERROR] ${err.message}`);
        }
    });

    socket.on('CALIBRATION_END', async (data) => {
        try {
            const payload = typeof data === 'string' ? JSON.parse(data) : data;
            const deviceInfo = await getPatientByDevice(payload.deviceId);
            const patientId = deviceInfo ? deviceInfo.patient_uuid : null;
            if (!patientId) return;

            const hrArray = activeCalibrations[patientId];
            const currentSessionId = activeSessions[patientId]?.sessionId || null;

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

    // ==========================================
    // CHANNEL 2: Listening ONLY to the Samsung Watch (IoT)
    // ==========================================

    socket.on('watch_vitals_update', async (data) => {
        try {
            // Support both old (raw object) and new (JSON string) payload formats
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;

            // Normalize fields — new Android format nests vitals under a `vitals` key
            const vitals          = parsed.vitals || {};
            const heartRate       = vitals.heartRate  ?? parsed.heartRate  ?? 0;
            const spo2            = vitals.spo2        ?? parsed.spo2;
            const ibiData         = vitals.ibiData     || parsed.ibiData    || [];

            // Use the device-reported stress score when available; otherwise derive it
            // from the IBI array using the RMSSD method (lower HRV = higher stress)
            const rawStress       = vitals.stressScore ?? parsed.stressScore ?? 0;
            const stressScore     = rawStress > 0 ? rawStress : calculateStressFromIBI(ibiData);

            // Broadcast to React FE that Watch is connected
            io.emit('watch_status_change', true);

            // Emit distress alert based on HR threshold
            io.emit('distress_alert', heartRate > 110);

            // Lazy binding: Android sends deviceId inside the payload, not in the handshake query.
            // If this socket has not yet been bound to a patient, attempt to resolve it now
            // using the deviceId extracted from the current packet.
            if (!socket.patientUuid) {
                const currentDeviceId = parsed.deviceId;
                if (currentDeviceId) {
                    try {
                        const deviceInfo = await getPatientByDevice(currentDeviceId);
                        if (deviceInfo) {
                            socket.patientUuid = deviceInfo.patient_uuid;
                            socket.nationalId  = deviceInfo.national_id;
                            socket.deviceType  = deviceInfo.device_type;
                            socket.deviceId    = currentDeviceId;
                            console.log(`[LAZY BIND] Device ${currentDeviceId} bound to patient: ${deviceInfo.national_id}`);

                            // Register Watch in the dual-device waiting room — session is only
                            // created once both VR and Watch are confirmed for this patient
                            if (!activeSessions[socket.patientUuid]) {
                                if (!pendingSessions[socket.patientUuid]) {
                                    pendingSessions[socket.patientUuid] = {
                                        vrReady: false, watchReady: false,
                                        vrDeviceId: null, watchDeviceId: null,
                                        vrSocketId: null, watchSocketId: null,
                                        nationalId: deviceInfo.national_id
                                    };
                                }
                                if (!pendingSessions[socket.patientUuid].watchReady) {
                                    pendingSessions[socket.patientUuid].watchReady    = true;
                                    pendingSessions[socket.patientUuid].watchDeviceId = currentDeviceId;
                                    pendingSessions[socket.patientUuid].watchSocketId = socket.id;
                                    pendingSessions[socket.patientUuid].nationalId    = deviceInfo.national_id;
                                    console.log(`[DUAL-DEVICE] Watch device ${currentDeviceId} ready for patient ${deviceInfo.national_id} — waiting for VR`);
                                    // Cache the first HR reading early so tryInitiateSession can use it for auto-calibration
                                    latestPatientHR[socket.patientUuid] = heartRate;
                                    await tryInitiateSession(socket.patientUuid, deviceInfo.national_id);
                                }
                            }
                        } else {
                            console.warn(`[Unassigned Stream] Device ${currentDeviceId} has no active kit assignment — skipping DB insert`);
                        }
                    } catch (bindErr) {
                        console.error(`[LAZY BIND] Failed to resolve device ${currentDeviceId}: ${bindErr.message}`);
                    }
                }
            }

            // Cache the latest HR for this patient to seed CALIBRATION_START
            if (socket.patientUuid) {
                latestPatientHR[socket.patientUuid] = heartRate;

                // If a calibration window is open for this patient, accumulate the HR sample
                if (activeCalibrations[socket.patientUuid] !== undefined && heartRate > 0) {
                    activeCalibrations[socket.patientUuid].push(heartRate);
                }
            }

            // Skip DB insertion if the socket is still unresolved after the lazy bind attempt
            if (!socket.patientUuid) {
                console.warn(`[Unassigned Stream] watch_vitals_update from unresolved socket ${socket.id} — skipping DB insert`);
                return;
            }

            // Update last_seen for this Watch device (throttled to once per 30 seconds)
            if (socket.deviceId) {
                throttledUpdateLastSeen(socket.deviceId);
            }

            // Look up the active session for this patient from the in-memory tracker
            const sessionData = activeSessions[socket.patientUuid];
            if (!sessionData) {
                console.warn(`[SESSION] No active session for patient ${socket.patientUuid} — skipping DB insert`);
                return;
            }

            const timestamp = new Date().toISOString();

            const currentPhase = sessionVrState[sessionData.sessionId]?.state ?? 'Preparation';

            // Persist raw watch telemetry to anxiety_profiles without modification:
            // patient_id = national_id (VARCHAR FK referencing patients.national_id)
            // session_id = UUID from the sessions table
            await insertAnxietyProfile({
                patientId:      sessionData.nationalId,
                sessionId:      sessionData.sessionId,
                timestamp,
                vrState:        currentPhase,
                difficulty:     sessionVrState[sessionData.sessionId]?.difficulty ?? LevelDiff.NONE,
                vitals:         { heartRate, stressScore, spo2, ibiData },
                therapistAction: 'None'
            });

            // Feed raw telemetry to the Rule Engine for anomaly detection and alert generation
            await processVitalsSample({
                sessionId:   sessionData.sessionId,
                patientUuid: socket.patientUuid,
                timestamp,
                heartRate,
                stressScore,
                spo2,
            });

        } catch (err) {
            console.error(`[WATCH] Failed to process watch_vitals_update from ${socket.id}: ${err.message}`);
        }
    });

    // Handle emergency stop requests from frontend
    socket.on('emergency_stop', (data) => {
        console.log(`[EMERGENCY] Manual emergency stop triggered by therapist: ${data.timestamp}`);
        io.emit('EMERGENCY_STOP', {
            timestamp: new Date().toISOString(),
            reason: 'Manual Therapist Override'
        });
    });

    // Handle progression feedback from therapist
    // socket.on('progression_feedback', (data) => {
    //     console.log(`[FEEDBACK] Therapist ${data.agreed ? 'agreed' : 'disagreed'} with system recommendation: ${data.timestamp}`);
    //     // Reset simulation for next scene
    //     if (data.agreed) {
    //         currentHr = BASELINE_HR;
    //         currentStress = BASELINE_STRESS;
    //         currentSpo2 = BASELINE_SPO2;
    //         simulationTime = 0;
    //         console.log(`[SIMULATION] Reset for next VR scene`);
    //     }
    // });

    socket.on('disconnect', async () => {
        console.log(`[CONNECTION] Client disconnected: ${socket.id}`);

        // Remove this socket from the dual-device waiting room if it was still pending
        if (socket.patientUuid && pendingSessions[socket.patientUuid]) {
            const pending = pendingSessions[socket.patientUuid];
            if (pending.vrSocketId === socket.id) {
                pending.vrReady    = false;
                pending.vrDeviceId = null;
                pending.vrSocketId = null;
                console.log(`[DUAL-DEVICE] VR disconnected before session started for patient ${socket.nationalId}`);
            } else if (pending.watchSocketId === socket.id) {
                pending.watchReady    = false;
                pending.watchDeviceId = null;
                pending.watchSocketId = null;
                console.log(`[DUAL-DEVICE] Watch disconnected before session started for patient ${socket.nationalId}`);
            }
            // Remove the pending slot entirely once no devices remain registered
            if (!pending.vrReady && !pending.watchReady) {
                delete pendingSessions[socket.patientUuid];
            }
        }

        // Complete the session when a device disconnects (safety net if SESSION_END was not received)
        if (socket.patientUuid) {
            const sessionData = activeSessions[socket.patientUuid];
            if (sessionData) {
                try {
                    // Flush any open rule-engine breaches before closing the session
                    await finalizeSession(sessionData.sessionId);
                    await completeSession(sessionData.sessionId);
                    // Update last_seen for this device in the devices table
                    if (socket.deviceId) {
                        try {
                            await updateDeviceLastSeen(socket.deviceId);
                        } catch (lsErr) {
                            console.error(`[DISCONNECT] Failed to update last_seen for device ${socket.deviceId}: ${lsErr.message}`);
                        }
                    }
                    console.log(`[SESSION] Session ${sessionData.sessionId} completed on disconnect for patient ${socket.nationalId}`);
                } catch (error) {
                    console.error(`[SESSION] Error completing session on disconnect:`, error);
                } finally {
                    delete activeSessions[socket.patientUuid];
                    delete latestPatientHR[socket.patientUuid];
                    delete activeCalibrations[socket.patientUuid];
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
initializeDatabase()
    .then(() => console.log('[INIT] Database initialization completed'))
    .catch((err) => console.error('[INIT] Database initialization failed:', err));

server.listen(PORT, () => {
    console.log(`AvioCalm Backend Server running on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/api/health`);
    console.log(`WebSocket Server is ready to accept connections`);
});
