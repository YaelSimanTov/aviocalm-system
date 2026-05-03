// src/db/dbManager.js
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

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

module.exports = {
    insertAnxietyProfile
};