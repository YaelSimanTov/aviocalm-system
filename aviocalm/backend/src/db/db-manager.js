// src/db/dbManager.js
const { Pool } = require('pg');
const { calculateRMSSD } = require('../services/hrv-calculator'); // Ensure this path is correct for your project

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

/**
 * Initialize database with required mock data
 * Ensures mock patient and therapist exist before simulator runs
 */
async function initializeDatabase() {
    try {
      // 1. Insert mock therapist required for foreign key
      const insertTherapistQuery = `
        INSERT INTO users (user_id, username, password_hash, salt, role, first_name, last_name)
        VALUES ('550e8400-e29b-41d4-a716-446655440001', 'mock_therapist', 'dummy_hash', 'dummy_salt', 'Therapist', 'Mock', 'Therapist')
        ON CONFLICT (user_id) DO NOTHING;
      `;
      await pool.query(insertTherapistQuery);

      // 2. Insert mock patient
      const insertPatientQuery = `
        INSERT INTO patients (id, national_id, full_name, therapist_id, status)
        VALUES ('550e8400-e29b-41d4-a716-446655440000', '123456789', 'Mock Patient', '550e8400-e29b-41d4-a716-446655440001', 'Active')
        ON CONFLICT (national_id) DO NOTHING;
      `;
      await pool.query(insertPatientQuery);

      console.log('[DB INIT] Mock users and patients verified successfully.');
    } catch (error) {
      console.error('[DB ERROR] Failed to initialize database:', error);
    }
}

/**
 * Inserts a synchronized patient record from the VR and Watch into the database.
 * @param {Object} record - The synchronized data object
 */
async function insertAnxietyProfile(record) {
    const query = `
        INSERT INTO "anxiety_profiles" 
        ("patient_id", "session_id", "recorded_at", "vr_state", "difficulty", "heart_rate", "stress_score", "spo2", "therapist_action")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    const values = [
        record.patientId || 'unknown',
        record.sessionId,
        record.timestamp,
        record.vrState,
        record.difficulty,
        record.vitals.heartRate,
        record.vitals.stressScore,
        record.vitals.spo2,
        record.therapistAction || 'None'
    ];

    try {
        await pool.query(query, values);
        console.log(`[DB] Successfully saved profile at ${record.timestamp}`);
    } catch (error) {
        console.error('[DB ERROR] Failed to insert anxiety profile:', error);
    }
}

// ==========================================
// DEVICE ROUTING & BASELINE (FROM SIMULATION)
// ==========================================

/**
 * Resolves the active patient ID based on VR Headset OR Watch device_id
 */
const getActivePatientByDevice = async (deviceId) => {
    const query = `
        SELECT pa.patient_id 
        FROM patient_assignments pa
        JOIN kits k ON pa.kit_id = k.kit_id
        WHERE (k.vr_device_id = $1 OR k.watch_device_id = $1)
        AND pa.unassigned_at IS NULL
        LIMIT 1;
    `;
    
    try {
        const result = await pool.query(query, [deviceId]);
        if (result.rows.length > 0) {
            return result.rows[0].patient_id;
        }
        return null; 
    } catch (error) {
        console.error(`[DB ERROR] Failed to resolve patient by device: ${error.message}`);
        throw error;
    }
};

/**
 * Fetches the historical resting HR for a specific patient
 */
const getPatientBaseline = async (patientId) => {
    const query = `
        SELECT avg_resting_hr 
        FROM patient_baselines 
        WHERE patient_id = $1 
        ORDER BY calibrated_at DESC 
        LIMIT 1;
    `;
    try {
        const result = await pool.query(query, [patientId]);
        return result.rows.length > 0 ? result.rows[0].avg_resting_hr : 0;
    } catch(err) {
        console.error(`[DB ERROR] Failed to fetch baseline: ${err.message}`);
        return 0;
    }
};

/**
 * Saves or updates the newly calibrated baseline
 */
const savePatientBaseline = async (patientId, sessionId, avgHr, avgStress = 0) => {
    const query = `
        INSERT INTO patient_baselines (patient_id, session_id, avg_resting_hr, avg_resting_stress, calibrated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (session_id) 
        DO UPDATE SET 
            avg_resting_hr = EXCLUDED.avg_resting_hr,
            avg_resting_stress = EXCLUDED.avg_resting_stress,
            calibrated_at = CURRENT_TIMESTAMP;
    `;
    try {
        await pool.query(query, [patientId, sessionId, avgHr, avgStress]);
        console.log(`[DB SUCCESS] Baseline saved successfully for patient: ${patientId}`);
    } catch (error) {
        console.error(`[DB ERROR] Failed to save patient baseline: ${error.message}`);
        throw error; 
    }
};

// ==========================================
// SESSION LIFECYCLE & HRV (COMBINED)
// ==========================================

/**
 * Creates a new treatment session for a patient
 */
async function createSession(sessionData) {
    const query = `
        INSERT INTO sessions (patient_id, started_at, status)
        VALUES ($1, $2, $3)
        RETURNING id
    `;
    
    const values = [
        sessionData.patientId,
        sessionData.startedAt || new Date().toISOString(),
        sessionData.status || 'In Progress'
    ];
    
    try {
        const result = await pool.query(query, values);
        console.log(`[DB] Session created with ID: ${result.rows[0].id}`);
        return result.rows[0].id;
    } catch (error) {
        console.error('[DB ERROR] Failed to create session:', error);
        throw error;
    }
}

/**
 * Function to dynamically create a new session when the headset is put on (Simplified Signature)
 * Often used by WebSockets where only patientId is available instantly.
 */
const createNewSession = async (patientId) => {
    const query = `
        INSERT INTO sessions (patient_id, started_at, status)
        VALUES ($1, CURRENT_TIMESTAMP, 'In Progress')
        RETURNING id;
    `;
    try {
        const result = await pool.query(query, [patientId]);
        if (result.rows.length > 0) {
            const newSessionId = result.rows[0].id;
            console.log(`[DB SUCCESS] Created new session in DB with ID: ${newSessionId}`);
            return newSessionId;
        }
        throw new Error("No rows returned from session insertion");
    } catch (error) {
        console.error(`[DB ERROR] Failed to create new session: ${error.message}`);
        throw error;
    }
};

/**
 * Function to close the session when the headset is taken off (Basic close without HRV)
 */
const endSession = async (sessionId) => {
    const query = `
        UPDATE sessions
        SET ended_at = CURRENT_TIMESTAMP, status = 'Completed'
        WHERE id = $1;
    `;
    await pool.query(query, [sessionId]);
};

/**
 * Updates a session with completion data and HRV metrics
 */
async function updateSession(sessionId, completionData) {
    const query = `
        UPDATE sessions 
        SET ended_at = $2, duration_minutes = $3, overall_hrv_rmssd = $4, status = $5
        WHERE id = $1
    `;
    
    const values = [
        sessionId,
        completionData.endedAt || new Date().toISOString(),
        completionData.durationMinutes,
        completionData.overallHrvRmssd || null,
        completionData.status || 'Completed'
    ];
    
    try {
        await pool.query(query, values);
        console.log(`[DB] Session ${sessionId} updated successfully`);
    } catch (error) {
        console.error('[DB ERROR] Failed to update session:', error);
        throw error;
    }
}

/**
 * Fetches heart rate data for a session and calculates HRV RMSSD
 */
async function calculateSessionHRV(sessionId) {
    try {
        const heartRateQuery = `
            SELECT heart_rate 
            FROM anxiety_profiles 
            WHERE session_id = $1 AND heart_rate IS NOT NULL AND heart_rate > 0
            ORDER BY recorded_at ASC
        `;
        
        const result = await pool.query(heartRateQuery, [sessionId]);
        
        if (result.rows.length === 0) {
            console.warn(`[DB] No heart rate data found for session ${sessionId}`);
            return null;
        }
        
        const heartRateData = result.rows.map(row => row.heart_rate);
        const hrvScore = calculateRMSSD(heartRateData);
        
        return hrvScore;
        
    } catch (error) {
        console.error('[DB ERROR] Failed to calculate session HRV:', error);
        return null;
    }
}

/**
 * Completes a session with automatic HRV calculation
 */
async function completeSessionWithHRV(sessionId, completionData = {}) {
    try {
        const hrvScore = await calculateSessionHRV(sessionId);
        
        const sessionUpdateData = {
            endedAt: completionData.endedAt || new Date().toISOString(),
            durationMinutes: completionData.durationMinutes,
            overallHrvRmssd: hrvScore,
            status: completionData.status || 'Completed'
        };
        
        await updateSession(sessionId, sessionUpdateData);

        // Compute and persist KPI aggregates while anxiety_profiles data is still hot
        await computeAndSaveSessionKPIs(sessionId);

        console.log(`[DB] Session ${sessionId} completed successfully with HRV: ${hrvScore}ms`);
        return true;
    } catch (error) {
        console.error('[DB ERROR] Failed to complete session with HRV:', error);
        return false;
    }
}

/**
 * Reads all anxiety_profiles rows for a completed session and writes
 * pre-computed KPI aggregates into the sessions table.
 * This runs once at session close so the analytics endpoint never needs
 * to re-aggregate raw data on page load.
 * @param {string} sessionId
 */
async function computeAndSaveSessionKPIs(sessionId) {
    try {
        const { rows } = await pool.query(
            `SELECT recorded_at, heart_rate, stress_score, spo2
             FROM anxiety_profiles
             WHERE session_id = $1
             ORDER BY recorded_at ASC`,
            [sessionId]
        );

        if (rows.length === 0) {
            console.warn(`[DB] No anxiety_profiles for session ${sessionId}, skipping KPI save`);
            return;
        }

        const total = rows.length;

        // Simple averages over all raw data points
        const sumHR     = rows.reduce((s, r) => s + (r.heart_rate   || 0), 0);
        const validSpo2 = rows.filter(r => r.spo2 != null && r.spo2 > 0);
        const sumSpo2   = validSpo2.reduce((s, r) => s + r.spo2, 0);
        const sumStress = rows.reduce((s, r) => s + (r.stress_score || 0), 0);

        const avgHR     = Math.round(sumHR / total);
        const avgSpo2   = validSpo2.length > 0 ? Math.round(sumSpo2 / validSpo2.length) : null;
        const avgStress = parseFloat((sumStress / total).toFixed(2));

        // Time-in-range percentages using the same thresholds as the original
        // calculateTimeInRange: stress < 40 = Relaxed, 40-75 = Moderate, > 75 = Panic
        let relaxedMs = 0;
        let moderateMs = 0;
        let panicMs = 0;

        for (let i = 0; i < rows.length - 1; i++) {
            const stress = rows[i].stress_score || 0;
            const dt = new Date(rows[i + 1].recorded_at).getTime()
                     - new Date(rows[i].recorded_at).getTime();
            if (stress < 40)       relaxedMs  += dt;
            else if (stress <= 75) moderateMs += dt;
            else                   panicMs    += dt;
        }

        const totalMs     = relaxedMs + moderateMs + panicMs;
        const relaxedPct  = totalMs > 0 ? Math.round((relaxedMs  / totalMs) * 100) : 0;
        const moderatePct = totalMs > 0 ? Math.round((moderateMs / totalMs) * 100) : 0;
        const panicPct    = totalMs > 0 ? Math.round((panicMs    / totalMs) * 100) : 0;

        await pool.query(
            `UPDATE sessions
             SET avg_heart_rate        = $2,
                 avg_spo2              = $3,
                 avg_stress_score      = $4,
                 time_relaxed_percent  = $5,
                 time_moderate_percent = $6,
                 time_panic_percent    = $7,
                 total_data_points     = $8
             WHERE id = $1`,
            [sessionId, avgHR, avgSpo2, avgStress, relaxedPct, moderatePct, panicPct, total]
        );

        console.log(
            `[DB] KPIs saved for session ${sessionId}: ` +
            `HR=${avgHR}, SpO2=${avgSpo2}, Stress=${avgStress}, ` +
            `Relaxed=${relaxedPct}%, Moderate=${moderatePct}%, Panic=${panicPct}%, Points=${total}`
        );
    } catch (error) {
        console.error(`[DB ERROR] Failed to compute/save session KPIs for ${sessionId}:`, error);
    }
}

/**
 * Gets patient treatment history with session analytics
 */
async function getPatientTreatmentHistory(patientId) {
    const query = `
        SELECT 
            s.id,
            s.started_at,
            s.ended_at,
            s.duration_minutes,
            s.overall_hrv_rmssd,
            s.status,
            COUNT(ap.log_id) as profile_count,
            AVG(ap.heart_rate) as avg_heart_rate,
            MAX(ap.stress_score) as peak_stress,
            AVG(ap.stress_score) as avg_stress_score
        FROM sessions s
        LEFT JOIN anxiety_profiles ap ON s.id = ap.session_id
        WHERE s.patient_id = $1
        GROUP BY s.id, s.started_at, s.ended_at, s.duration_minutes, s.overall_hrv_rmssd, s.status
        ORDER BY s.started_at DESC
    `;
    
    try {
        const result = await pool.query(query, [patientId]);
        return result.rows;
    } catch (error) {
        console.error('[DB ERROR] Failed to get treatment history:', error);
        throw error;
    }
}


/**
 * Returns the session_id of the current 'In Progress' session for a patient.
 * Used as a DB fallback when the activeSessions in-memory map has no entry.
 * @param {string} patientId - patient UUID
 * @returns {Promise<string|null>}
 */
async function getActiveSessionForPatient(patientId) {
    const result = await pool.query(
        'SELECT id FROM sessions WHERE patient_id = $1 AND status = ' + "'In Progress'" + ' ORDER BY started_at DESC LIMIT 1',
        [patientId]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
}

async function insertVrEvent(sessionId, tag, message) {
    await pool.query(
        'INSERT INTO vr_events (session_id, tag, message) VALUES ($1, $2, $3)',
        [sessionId, tag, message]
    );
}

/**
 * Returns all VR events for a session, sorted chronologically.
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
async function getVrEventsBySession(sessionId) {
    const result = await pool.query(
        'SELECT id, session_id, timestamp, tag, message FROM vr_events WHERE session_id = $1 ORDER BY timestamp ASC',
        [sessionId]
    );
    return result.rows;
}

/**
 * Stamps the current timestamp on a device record when a session concludes.
 * Called after SESSION_END and socket disconnect events.
 * @param {string} deviceId - The UUID of the device to update
 */
async function updateDeviceLastSeen(deviceId) {
    await pool.query(
        'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
        [deviceId]
    );
}
module.exports = {
    initializeDatabase,
    insertAnxietyProfile,

    // Routing & Calibration
    getActivePatientByDevice,
    getPatientBaseline,
    savePatientBaseline,

    // Sessions & Analytics
    createSession,
    createNewSession,
    updateSession,
    endSession,
    calculateSessionHRV,
    completeSessionWithHRV,
    computeAndSaveSessionKPIs,
    getPatientTreatmentHistory,

    // Device tracking
    updateDeviceLastSeen,

    // VR event log
    getActiveSessionForPatient,
    insertVrEvent,
    getVrEventsBySession
};
