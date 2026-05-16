// src/db/dbManager.js
const { Pool } = require('pg');
const { calculateRMSSD } = require('../services/hrvCalculator');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

/**
 * Inserts a synchronized patient record from the VR and Watch into the database.
 * Updated to work with new sessions table structure
 * @param {Object} record - The synchronized data object
 */
async function insertAnxietyProfile(record) {
    const query = `
        INSERT INTO "anxiety_profiles" 
        ("patient_id", "session_id", "recorded_at", "vr_state", "difficulty", "heart_rate", "stress_score", "spo2", "therapist_action")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    // Mapping the object fields to the query parameters
    const values = [
        record.patientId || 'unknown', // Use provided patientId or default to 'unknown'
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
 * Creates a new treatment session for a patient
 * @param {Object} sessionData - Session information
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
 * Updates a session with completion data and HRV metrics
 * @param {String} sessionId - Session ID
 * @param {Object} completionData - Session completion information
 */
async function updateSession(sessionId, completionData) {
    const query = `
        UPDATE sessions 
        SET ended_at = $2, duration_minutes = $3, overall_hrv_rmssd = $4, status = $5
        WHERE id = $1
    `;
    
    const values = [
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
 * Gets patient treatment history with session analytics
 * @param {String} patientId - Patient ID
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
 * Fetches heart rate data for a session and calculates HRV RMSSD
 * @param {String} sessionId - Session ID to calculate HRV for
 * @returns {Promise<number|null>} - Calculated HRV RMSSD score or null if calculation fails
 */
async function calculateSessionHRV(sessionId) {
    try {
        // Fetch all heart rate values for the session
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
        
        // Extract heart rate values into a flat array
        const heartRateData = result.rows.map(row => row.heart_rate);
        
        console.log(`[DB] Found ${heartRateData.length} heart rate readings for session ${sessionId}`);
        
        // Calculate HRV using the RMSSD method
        const hrvScore = calculateRMSSD(heartRateData);
        
        if (hrvScore !== null) {
            console.log(`[DB] HRV RMSSD calculated for session ${sessionId}: ${hrvScore}ms`);
        } else {
            console.warn(`[DB] Failed to calculate HRV for session ${sessionId}`);
        }
        
        return hrvScore;
        
    } catch (error) {
        console.error('[DB ERROR] Failed to calculate session HRV:', error);
        return null;
    }
}

/**
 * Completes a session with automatic HRV calculation
 * @param {String} sessionId - Session ID to complete
 * @param {Object} completionData - Session completion information
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
async function completeSessionWithHRV(sessionId, completionData = {}) {
    try {
        // First calculate HRV for the session
        const hrvScore = await calculateSessionHRV(sessionId);
        
        // Prepare session update data
        const sessionUpdateData = {
            endedAt: completionData.endedAt || new Date().toISOString(),
            durationMinutes: completionData.durationMinutes,
            overallHrvRmssd: hrvScore,
            status: completionData.status || 'Completed'
        };
        
        // Update the session with HRV data
        await updateSession(sessionId, sessionUpdateData);
        
        console.log(`[DB] Session ${sessionId} completed successfully with HRV: ${hrvScore}ms`);
        return true;
        
    } catch (error) {
        console.error('[DB ERROR] Failed to complete session with HRV:', error);
        return false;
    }
}

/**
 * Inserts a treatment decision record into the database
 * Part of Epic 4.3: Asynchronous Recommendation & Audit
 * @param {Object} treatmentDecision - The treatment decision object
 * @param {string} treatmentDecision.session_id - Session ID
 * @param {string} treatmentDecision.patient_id - Patient ID
 * @param {number} treatmentDecision.suggested_difficulty - System-recommended difficulty (1-5)
 * @param {number} treatmentDecision.actual_difficulty_selected_by_patient - Patient's selected difficulty (1-5)
 * @param {string} treatmentDecision.system_timestamp - Timestamp when system made the recommendation
 */
async function insertTreatmentDecision(treatmentDecision) {
    const query = `
        INSERT INTO treatment_decisions 
        (session_id, patient_id, suggested_difficulty, actual_difficulty_selected_by_patient, system_timestamp)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING decision_id
    `;
    
    const values = [
        treatmentDecision.session_id,
        treatmentDecision.patient_id,
        treatmentDecision.suggested_difficulty,
        treatmentDecision.actual_difficulty_selected_by_patient,
        treatmentDecision.system_timestamp
    ];

    try {
        const result = await pool.query(query, values);
        console.log(`[DB] Treatment decision saved with ID: ${result.rows[0].decision_id}`);
        return result.rows[0].decision_id;
    } catch (error) {
        console.error('[DB ERROR] Failed to insert treatment decision:', error);
        throw error;
    }
}

/**
 * Fetches treatment decisions for a specific session
 * Part of Epic 4.3: Asynchronous Recommendation & Audit
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Array of treatment decision records
 */
async function getTreatmentDecisionsBySession(sessionId) {
    const query = `
        SELECT 
            decision_id,
            session_id,
            patient_id,
            suggested_difficulty,
            actual_difficulty_selected_by_patient,
            system_timestamp,
            created_at
        FROM treatment_decisions
        WHERE session_id = $1
        ORDER BY system_timestamp ASC
    `;
    
    try {
        const result = await pool.query(query, [sessionId]);
        console.log(`[DB] Found ${result.rows.length} treatment decisions for session ${sessionId}`);
        return result.rows;
    } catch (error) {
        console.error('[DB ERROR] Failed to fetch treatment decisions:', error);
        throw error;
    }
}

/**
 * Calculates HRV RMSSD from heart rate intervals (Legacy function - kept for compatibility)
 * @param {Array} heartRateValues - Array of heart rate measurements
 * @deprecated Use calculateRMSSD from hrvCalculator service instead
 */
function calculateHRVRmssd(heartRateValues) {
    console.warn('[DB] calculateHRVRmssd is deprecated. Use calculateRMSSD from hrvCalculator service instead.');
    return calculateRMSSD(heartRateValues);
}

module.exports = {
    insertAnxietyProfile,
    initializeDatabase,
    createSession,
    updateSession,
    getPatientTreatmentHistory,
    calculateSessionHRV,
    completeSessionWithHRV,
    calculateHRVRmssd,
    insertTreatmentDecision,
    getTreatmentDecisionsBySession
};
