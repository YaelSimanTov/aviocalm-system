/**
 * Assignment Service
 * Handles business logic for patient-kit assignment lifecycle
 * Validates kit availability and prevents double-booking
 */

const pool = require('../config/db');

class AssignmentService {
    /**
     * Assign a kit to a patient
     * @param {Object} assignmentData - Assignment information
     * @returns {Promise<Object>} Created assignment record
     */
    async assignKit(assignmentData) {
        const { patient_id, kit_id } = assignmentData;

        // Validate required fields
        if (!patient_id || !kit_id) {
            throw new Error('patient_id and kit_id are required');
        }

        // Verify patient exists
        const patientQuery = 'SELECT id FROM patients WHERE id = $1';
        const patientResult = await pool.query(patientQuery, [patient_id]);

        if (patientResult.rows.length === 0) {
            throw new Error('Patient not found');
        }

        // Verify kit exists
        const kitQuery = 'SELECT kit_id FROM kits WHERE kit_id = $1';
        const kitResult = await pool.query(kitQuery, [kit_id]);

        if (kitResult.rows.length === 0) {
            throw new Error('Kit not found');
        }

        // Check if kit is already assigned (active assignment with unassigned_at IS NULL)
        const activeAssignmentQuery = `
            SELECT assignment_id
            FROM patient_assignments
            WHERE kit_id = $1 AND unassigned_at IS NULL
        `;

        const activeAssignmentResult = await pool.query(activeAssignmentQuery, [kit_id]);

        if (activeAssignmentResult.rows.length > 0) {
            throw new Error('Kit is already assigned to another patient');
        }

        // Create the assignment
        const insertQuery = `
            INSERT INTO patient_assignments (patient_id, kit_id)
            VALUES ($1, $2)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [patient_id, kit_id]);

        return result.rows[0];
    }

    /**
     * Release a kit assignment (by patient_id or kit_id)
     * @param {Object} releaseData - Release information (patient_id OR kit_id)
     * @returns {Promise<Object>} Updated assignment record
     */
    async releaseKit(releaseData) {
        const { patient_id, kit_id } = releaseData;

        // At least one identifier must be provided
        if (!patient_id && !kit_id) {
            throw new Error('Either patient_id or kit_id must be provided');
        }

        let query, params, paramName;

        if (patient_id) {
            // Release by patient_id
            query = `
                UPDATE patient_assignments
                SET unassigned_at = CURRENT_TIMESTAMP
                WHERE patient_id = $1 AND unassigned_at IS NULL
                RETURNING *
            `;
            params = [patient_id];
            paramName = 'patient_id';
        } else {
            // Release by kit_id
            query = `
                UPDATE patient_assignments
                SET unassigned_at = CURRENT_TIMESTAMP
                WHERE kit_id = $1 AND unassigned_at IS NULL
                RETURNING *
            `;
            params = [kit_id];
            paramName = 'kit_id';
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            throw new Error(`No active assignment found for the provided ${paramName}`);
        }

        return result.rows[0];
    }

    /**
     * Get active assignment for a specific patient
     * @param {string} patientId - The patient ID
     * @returns {Promise<Object|null>} Active assignment record or null
     */
    async getPatientActiveAssignment(patientId) {
        const query = `
            SELECT 
                pa.assignment_id,
                pa.patient_id,
                pa.kit_id,
                pa.assigned_at,
                pa.unassigned_at,
                k.vr_device_id,
                k.watch_device_id,
                vr.device_type as vr_device_type,
                vr.status as vr_status,
                w.device_type as watch_device_type,
                w.status as watch_status
            FROM patient_assignments pa
            LEFT JOIN kits k ON pa.kit_id = k.kit_id
            LEFT JOIN devices vr ON k.vr_device_id = vr.device_id
            LEFT JOIN devices w ON k.watch_device_id = w.device_id
            WHERE pa.patient_id = $1 AND pa.unassigned_at IS NULL
        `;

        const result = await pool.query(query, [patientId]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    /**
     * Get active assignment for a specific kit
     * @param {string} kitId - The kit ID
     * @returns {Promise<Object|null>} Active assignment record or null
     */
    async getKitActiveAssignment(kitId) {
        const query = `
            SELECT 
                pa.assignment_id,
                pa.patient_id,
                pa.kit_id,
                pa.assigned_at,
                pa.unassigned_at,
                p.full_name as patient_name,
                p.national_id as patient_national_id
            FROM patient_assignments pa
            LEFT JOIN patients p ON pa.patient_id = p.id
            WHERE pa.kit_id = $1 AND pa.unassigned_at IS NULL
        `;

        const result = await pool.query(query, [kitId]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }
}

// Create singleton instance
const assignmentService = new AssignmentService();

module.exports = {
    assignKit: (data) => assignmentService.assignKit(data),
    releaseKit: (data) => assignmentService.releaseKit(data),
    getPatientActiveAssignment: (patientId) => assignmentService.getPatientActiveAssignment(patientId),
    getKitActiveAssignment: (kitId) => assignmentService.getKitActiveAssignment(kitId)
};
