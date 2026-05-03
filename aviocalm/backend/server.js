const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

// ==========================================
// Database
// ==========================================
const pool = require("./config/db");
const { insertAnxietyProfile } = require("./db/dbManager");

// ==========================================
// Routes
// ==========================================
const authRoutes = require("./routes/auth-routes");
const ownerRoutes = require("./routes/owner-routes");
const patientsRoutes = require("./routes/patients-routes");

// ==========================================
// App Initialization
// ==========================================
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ==========================================
// HTTP Server + Socket.io
// ==========================================
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// ==========================================
// Global Runtime State
// ==========================================
let currentVrState = "BoardingState";
let currentDifficulty = "None";

let connectedClientsCount = 0;
let watchPacketCounter = 0;
let vrPacketCounter = 0;

// ==========================================
// Startup Logs
// ==========================================
console.log("=========================================");
console.log("[BOOT] Starting AvioCalm Backend...");
console.log(`[BOOT] NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(`[BOOT] PORT: ${PORT}`);
console.log("[BOOT] Socket.io initialized");
console.log("=========================================");

// ==========================================
// REST API Routes
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/patients", patientsRoutes);

// ==========================================
// Health Check
// ==========================================
app.get("/api/health", (req, res) => {
    console.log("[HTTP] GET /api/health");

    res.json({
        success: true,
        data: {
            status: "Server running",
            timestamp: new Date().toISOString(),
            socket: {
                connectedClientsCount,
                currentVrState,
                currentDifficulty,
            },
        },
    });
});

// ==========================================
// Recent Watch Data For React
// ==========================================
app.get("/api/watch/recent", async (req, res) => {
    const { patientId } = req.query;

    console.log("[HTTP] GET /api/watch/recent");
    console.log("[HTTP] patientId:", patientId);

    if (!patientId) {
        console.warn("[HTTP WARNING] Missing patientId in /api/watch/recent");

        return res.status(400).json({
            success: false,
            message: "patientId is required",
        });
    }

    try {
        const result = await pool.query(
            `
      SELECT *
      FROM anxiety_profiles
      WHERE patient_id = $1
      ORDER BY recorded_at DESC
      LIMIT 50
      `,
            [patientId]
        );

        console.log(`[HTTP] Found ${result.rows.length} recent records`);

        res.json({
            success: true,
            data: result.rows.reverse(),
        });
    } catch (error) {
        console.error("[HTTP DB ERROR] Failed to load recent watch data");
        console.error("[HTTP DB ERROR]", error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

// ==========================================
// Debug Route
// ==========================================
app.get("/api/socket/status", (req, res) => {
    console.log("[HTTP] GET /api/socket/status");

    res.json({
        success: true,
        data: {
            connectedClientsCount,
            currentVrState,
            currentDifficulty,
            watchPacketCounter,
            vrPacketCounter,
            timestamp: new Date().toISOString(),
        },
    });
});

// ==========================================
// Helper Functions
// ==========================================
function safeStringify(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        return String(value);
    }
}

function normalizeSocketPayload(payload) {
    if (!payload) return {};

    if (typeof payload === "string") {
        try {
            return JSON.parse(payload);
        } catch (error) {
            console.warn("[PAYLOAD WARNING] Payload is string but not valid JSON");
            console.warn("[PAYLOAD WARNING] Raw payload:", payload);
            return {};
        }
    }

    if (typeof payload === "object") {
        return payload;
    }

    console.warn("[PAYLOAD WARNING] Unsupported payload type:", typeof payload);
    return {};
}

function toNumberOrNull(value) {
    if (value === null || value === undefined) return null;
    if (value === "") return null;
    if (value === "null") return null;
    if (value === "undefined") return null;

    const num = Number(value);

    if (Number.isNaN(num)) return null;

    return num;
}

function toIntegerOrNull(value) {
    const num = toNumberOrNull(value);

    if (num === null) return null;

    return Math.round(num);
}

function calculateStressScore(heartRate, spo2) {
    let score = 0;

    if (heartRate >= 110) score += 60;
    else if (heartRate >= 100) score += 45;
    else if (heartRate >= 90) score += 30;
    else if (heartRate >= 80) score += 15;
    else score += 5;

    if (spo2 !== null && spo2 !== undefined) {
        if (spo2 < 90) score += 40;
        else if (spo2 < 94) score += 25;
        else if (spo2 < 96) score += 10;
    }

    return Math.min(score, 100);
}

function detectDistressAlert(heartRate, spo2, stressScore) {
    if (spo2 !== null && spo2 !== undefined && spo2 < 92) {
        return {
            active: true,
            reason: "Low SpO2",
        };
    }

    if (heartRate >= 110) {
        return {
            active: true,
            reason: "High Heart Rate",
        };
    }

    if (stressScore >= 75) {
        return {
            active: true,
            reason: "High Stress Level",
        };
    }

    return {
        active: false,
        reason: null,
    };
}

function validateWatchData(sensorData) {
    const heartRate = toIntegerOrNull(sensorData.heartRate);
    const spo2 = toIntegerOrNull(sensorData.spo2);

    const errors = [];
    const warnings = [];

    if (heartRate === null) {
        errors.push("heartRate is missing or invalid");
    } else if (heartRate <= 0) {
        errors.push("heartRate must be greater than 0");
    } else if (heartRate < 30 || heartRate > 220) {
        warnings.push(`heartRate looks unusual: ${heartRate}`);
    }

    if (spo2 !== null) {
        if (spo2 < 50 || spo2 > 100) {
            warnings.push(`spo2 looks unusual: ${spo2}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        normalized: {
            heartRate,
            spo2,
            sessionId: sensorData.sessionId || "active-session",
            patientId: sensorData.patientId || "unknown",
        },
    };
}

// ==========================================
// Socket.io Low-Level Connection Errors
// ==========================================
io.engine.on("connection_error", (err) => {
    console.error("=========================================");
    console.error("[SOCKET CONNECTION ERROR]");
    console.error("[SOCKET CONNECTION ERROR] code:", err.code);
    console.error("[SOCKET CONNECTION ERROR] message:", err.message);
    console.error("[SOCKET CONNECTION ERROR] context:", err.context);
    console.error("=========================================");
});

// ==========================================
// Socket.io Main Logic
// ==========================================
io.on("connection", (socket) => {
    connectedClientsCount++;

    console.log("=========================================");
    console.log(`[CONNECTION] Client connected: ${socket.id}`);
    console.log(`[CONNECTION] Total connected clients: ${connectedClientsCount}`);
    console.log("[CONNECTION] IP:", socket.handshake.address);
    console.log("[CONNECTION] Transport:", socket.conn.transport.name);
    console.log("[CONNECTION] User-Agent:", socket.handshake.headers["user-agent"]);
    console.log("[CONNECTION] Query:", socket.handshake.query);
    console.log("=========================================");

    socket.emit("server_ack", {
        success: true,
        message: "Connected to AvioCalm backend",
        socketId: socket.id,
        timestamp: new Date().toISOString(),
    });

    // --------------------------------------------------
    // VERY IMPORTANT DEBUG:
    // This catches every event arriving to the backend.
    // If this does not print, Android is not emitting.
    // --------------------------------------------------
    socket.onAny((eventName, ...args) => {
        console.log("--------------- SOCKET EVENT RECEIVED ---------------");
        console.log(`[SOCKET EVENT] From socket: ${socket.id}`);
        console.log(`[SOCKET EVENT] Event name: ${eventName}`);
        console.log(`[SOCKET EVENT] Args count: ${args.length}`);
        console.log("[SOCKET EVENT] Args:", safeStringify(args));
        console.log("-----------------------------------------------------");
    });

    // ==========================================
    // CHANNEL 1: Unity / VR Event
    // ==========================================
    socket.on("vr_event", (data) => {
        vrPacketCounter++;

        console.log("=========================================");
        console.log(`[UNITY VR #${vrPacketCounter}] vr_event received`);
        console.log("[UNITY VR] Raw data:", safeStringify(data));

        const payload = normalizeSocketPayload(data);

        if (payload.flightState) {
            currentVrState = payload.flightState;
        }

        if (payload.difficulty) {
            currentDifficulty = payload.difficulty;
        }

        console.log("[UNITY VR] Updated currentVrState:", currentVrState);
        console.log("[UNITY VR] Updated currentDifficulty:", currentDifficulty);
        console.log("=========================================");

        io.emit("vr_status_change", true);

        io.emit("vr_state_update", {
            flightState: currentVrState,
            difficulty: currentDifficulty,
            timestamp: new Date().toISOString(),
        });
    });

    // ==========================================
    // CHANNEL 2: Samsung Watch / IoT Vitals
    // ==========================================
    socket.on("watch_vitals_update", async (rawSensorData) => {
        watchPacketCounter++;

        const packetId = watchPacketCounter;
        const receivedAt = new Date().toISOString();

        console.log("=========================================");
        console.log(`[WATCH #${packetId}] watch_vitals_update received`);
        console.log(`[WATCH #${packetId}] Received at: ${receivedAt}`);
        console.log(`[WATCH #${packetId}] Socket ID: ${socket.id}`);
        console.log(`[WATCH #${packetId}] Raw payload:`, safeStringify(rawSensorData));

        const sensorData = normalizeSocketPayload(rawSensorData);

        console.log(`[WATCH #${packetId}] Normalized payload:`, safeStringify(sensorData));

        const validation = validateWatchData(sensorData);

        if (validation.warnings.length > 0) {
            console.warn(`[WATCH #${packetId}] Validation warnings:`, validation.warnings);
        }

        if (!validation.isValid) {
            console.error(`[WATCH #${packetId}] Invalid watch data`);
            console.error(`[WATCH #${packetId}] Errors:`, validation.errors);

            socket.emit("watch_vitals_ack", {
                success: false,
                packetId,
                message: "Invalid watch data",
                errors: validation.errors,
                timestamp: new Date().toISOString(),
            });

            console.log("=========================================");
            return;
        }

        const { heartRate, spo2, sessionId, patientId } = validation.normalized;

        console.log(`[WATCH #${packetId}] heartRate: ${heartRate}`);
        console.log(`[WATCH #${packetId}] spo2: ${spo2}`);
        console.log(`[WATCH #${packetId}] sessionId: ${sessionId}`);
        console.log(`[WATCH #${packetId}] patientId: ${patientId}`);
        console.log(`[WATCH #${packetId}] Current VR State: ${currentVrState}`);
        console.log(`[WATCH #${packetId}] Current Difficulty: ${currentDifficulty}`);

        io.emit("watch_status_change", true);

        // 1. Calculate stress
        const stressScore = calculateStressScore(heartRate, spo2);

        console.log(`[WATCH #${packetId}] Calculated stressScore: ${stressScore}`);

        // 2. Detect distress
        const distressAlert = detectDistressAlert(heartRate, spo2, stressScore);

        console.log(`[WATCH #${packetId}] Distress alert:`, safeStringify(distressAlert));

        // 3. Build DB record
        const syncedPatientRecord = {
            patient_id: patientId,
            session_id: sessionId,
            vr_state: currentVrState,
            difficulty: currentDifficulty,
            heart_rate: heartRate,
            stress_score: stressScore,
            spo2: spo2,
            therapist_action: "None",
        };

        console.log(`[WATCH #${packetId}] DB record prepared:`);
        console.log(safeStringify(syncedPatientRecord));

        // 4. Save to PostgreSQL
        try {
            console.log(`[WATCH #${packetId}] Saving record to PostgreSQL...`);

            await insertAnxietyProfile(syncedPatientRecord);

            console.log(`[WATCH #${packetId}] DB save success`);
        } catch (dbError) {
            console.error(`[WATCH #${packetId}] DB save failed`);
            console.error(`[WATCH #${packetId}] DB error message:`, dbError.message);
            console.error(`[WATCH #${packetId}] Full DB error:`, dbError);
        }

        // 5. Build live DTO for React
        const liveMetricsDTO = {
            timestamp: receivedAt,

            // For frontend compatibility
            hr: heartRate,
            heartRate: heartRate,

            spo2: spo2,
            stressScore: stressScore,

            vrState: currentVrState,
            flightState: currentVrState,
            difficulty: currentDifficulty,

            patientId: patientId,
            sessionId: sessionId,

            isWarning: heartRate > 100 || stressScore > 60,
            isEmergency: heartRate >= 120 || stressScore > 80,
        };

        console.log(`[WATCH #${packetId}] Emitting live_metrics to React:`);
        console.log(safeStringify(liveMetricsDTO));

        io.emit("live_metrics", liveMetricsDTO);

        // 6. Emit distress alert
        const distressAlertDTO = {
            ...distressAlert,
            timestamp: receivedAt,
            values: {
                heartRate,
                spo2,
                stressScore,
            },
            patientId,
            sessionId,
        };

        console.log(`[WATCH #${packetId}] Emitting distress_alert:`);
        console.log(safeStringify(distressAlertDTO));

        io.emit("distress_alert", distressAlertDTO);

        // 7. Emergency stop if needed
        if (liveMetricsDTO.isEmergency) {
            const emergencyDTO = {
                timestamp: receivedAt,
                reason: distressAlert.reason || "Critical Biometric Threshold Breached",
                values: {
                    heartRate,
                    spo2,
                    stressScore,
                },
                patientId,
                sessionId,
            };

            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.error(`[EMERGENCY] Auto-Stop Triggered`);
            console.error("[EMERGENCY] Data:", safeStringify(emergencyDTO));
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

            io.emit("EMERGENCY_STOP", emergencyDTO);
        }

        // 8. Ack back to the watch
        socket.emit("watch_vitals_ack", {
            success: true,
            packetId,
            message: "Vitals received by backend",
            timestamp: new Date().toISOString(),
            received: {
                heartRate,
                spo2,
                stressScore,
                currentVrState,
                currentDifficulty,
            },
        });

        console.log(`[WATCH #${packetId}] Finished handling packet successfully`);
        console.log("=========================================");
    });

    // ==========================================
    // CHANNEL 3: Manual Emergency Stop From React
    // ==========================================
    socket.on("emergency_stop", (data) => {
        console.log("=========================================");
        console.log("[EMERGENCY] Manual emergency_stop event received");
        console.log("[EMERGENCY] Raw data:", safeStringify(data));
        console.log("[EMERGENCY] Triggered by socket:", socket.id);
        console.log("=========================================");

        io.emit("EMERGENCY_STOP", {
            timestamp: new Date().toISOString(),
            reason: "Manual Therapist Override",
            source: "React Frontend",
        });
    });

    // ==========================================
    // Optional Debug Event From Any Client
    // ==========================================
    socket.on("debug_ping", (data) => {
        console.log("=========================================");
        console.log("[DEBUG] debug_ping received");
        console.log("[DEBUG] data:", safeStringify(data));
        console.log("=========================================");

        socket.emit("debug_pong", {
            success: true,
            message: "Backend received debug_ping",
            timestamp: new Date().toISOString(),
        });
    });

    // ==========================================
    // Disconnect
    // ==========================================
    socket.on("disconnect", (reason) => {
        connectedClientsCount = Math.max(connectedClientsCount - 1, 0);

        console.log("=========================================");
        console.log(`[CONNECTION] Client disconnected: ${socket.id}`);
        console.log(`[CONNECTION] Reason: ${reason}`);
        console.log(`[CONNECTION] Total connected clients: ${connectedClientsCount}`);
        console.log("=========================================");
    });
});

// ==========================================
// 404 Handler
// ==========================================
app.use((req, res) => {
    console.warn(`[HTTP 404] ${req.method} ${req.originalUrl}`);

    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
    });
});

// ==========================================
// Global Error Handler
// ==========================================
app.use((err, req, res, next) => {
    console.error("=========================================");
    console.error("[GLOBAL ERROR]");
    console.error("[GLOBAL ERROR] Route:", req.method, req.originalUrl);
    console.error("[GLOBAL ERROR] Message:", err.message);
    console.error("[GLOBAL ERROR] Stack:", err.stack);
    console.error("=========================================");

    res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

// ==========================================
// Start Server
// ==========================================
server.listen(PORT, "0.0.0.0", () => {
    console.log("=========================================");
    console.log(`AvioCalm Backend running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Socket status: http://localhost:${PORT}/api/socket/status`);
    console.log("Listening on 0.0.0.0");
    console.log("Waiting for Samsung Watch / React / Unity connections...");
    console.log("=========================================");
});