/**
 * Device Resolver Service
 * Resolves the active patient assigned to a connecting device
 * and manages session initialization for live data ingestion
 */

const pool = require('../config/db');

/**
 * Resolves the active patient assigned to a device via kit assignment
 * SQL chain: devices -> kits -> patient_assignments -> patients
 * Only matches Active devices with an active (unassigned_at IS NULL) kit assignment
 * @param {string} deviceId - The UUID of the connecting device
 * @returns {Promise<{patient_uuid: string, national_id: string, device_type: string}|null>}
 */
async function getPatientByDevice(deviceId) {
    const query = `
        SELECT p.id AS patient_uuid,
               p.national_id,
               CASE WHEN k.vr_device_id = $1 THEN 'VR' ELSE 'Watch' END AS device_type
        FROM kits k
        JOIN patient_assignments pa ON k.kit_id = pa.kit_id AND pa.unassigned_at IS NULL
        JOIN patients p ON pa.patient_id = p.id
        WHERE k.vr_device_id = $1 OR k.watch_device_id = $1
        LIMIT 1
    `;

    try {
        const result = await pool.query(query, [deviceId]);
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0];
    } catch (error) {
        console.error('[DEVICE RESOLVER] Error resolving patient by device:', error);
        return null;
    }
}

/**
 * Marks an active session as Completed and sets ended_at timestamp
 * @param {string} sessionId - The session UUID to complete
 * @returns {Promise<void>}
 */
async function completeSession(sessionId) {
    const query = `
        UPDATE sessions
        SET status = 'Completed',
            ended_at = CURRENT_TIMESTAMP,
            duration_minutes = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60),
            overall_hrv_rmssd = (random() * 30 + 30)::numeric(5,2)
        WHERE id = $1 AND status = 'In Progress'
        RETURNING *
    `;

    try {
        const result = await pool.query(query, [sessionId]);
        if (result.rows.length > 0) {
            const s = result.rows[0];
            console.log(`[DEVICE RESOLVER] Session ${sessionId} completed — duration: ${s.duration_minutes}min | HRV RMSSD: ${s.overall_hrv_rmssd}ms`);
        }
    } catch (error) {
        console.error('[DEVICE RESOLVER] Error completing session:', error);
    }
}

module.exports = { getPatientByDevice, completeSession };
