const pool = require('../config/db');

/**
 * שומר רשומה מסונכרנת של נתוני דופק ו-VR לטבלה anxiety_profiles
 * תואם למבנה ה-DB: log_id, patient_id, session_id, recorded_at, vr_state, difficulty, heart_rate, stress_score, spo2, therapist_action
 */
async function insertAnxietyProfile(record) {
    const query = `
        INSERT INTO anxiety_profiles 
        (patient_id, session_id, vr_state, difficulty, heart_rate, stress_score, spo2, therapist_action)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;

    // מיפוי הערכים לפי הסדר בשאילתה ($1 עד $8)
    // הערה: log_id ו-recorded_at נוצרים אוטומטית ב-DB
    const values = [
        record.patient_id,      // $1
        record.session_id,      // $2
        record.vr_state,        // $3
        record.difficulty,      // $4
        record.heart_rate,      // $5
        record.stress_score,    // $6
        record.spo2,            // $7
        record.therapist_action // $8
    ];

    try {
        const result = await pool.query(query, values);
        console.log(`[DB] Profile saved successfully for patient ${record.patient_id}. Log ID: ${result.rows[0].log_id}`);
        return result.rows[0];
    } catch (error) {
        console.error('[DB ERROR] Failed to insert into anxiety_profiles:', error.message);
        throw error;
    }
}

module.exports = {
    insertAnxietyProfile
};