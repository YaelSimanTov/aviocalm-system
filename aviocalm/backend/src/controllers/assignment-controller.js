/**
 * Assignment Controller
 * Handles HTTP requests for patient-kit assignment lifecycle
 */

const { assignKit, releaseKit, getPatientActiveAssignment, getKitActiveAssignment } = require('../services/assignment-service');

/**
 * Assign a kit to a patient
 * POST /api/v1/assignments/assign
 */
const assignKitHandler = async (req, res) => {
    try {
        const { patient_id, kit_id } = req.body;

        // Validation
        if (!patient_id || !kit_id) {
            return res.status(400).json({
                success: false,
                error: 'patient_id and kit_id are required'
            });
        }

        // Assign kit via service (includes validation)
        const assignment = await assignKit({ patient_id, kit_id });

        res.status(201).json({
            success: true,
            data: {
                assignment_id: assignment.assignment_id,
                patient_id: assignment.patient_id,
                kit_id: assignment.kit_id,
                assigned_at: assignment.assigned_at
            }
        });

    } catch (error) {
        console.error('Assign kit error:', error);
        
        // Handle specific validation errors
        if (error.message.includes('not found') || error.message.includes('already assigned')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Release a kit assignment
 * PATCH /api/v1/assignments/release
 */
const releaseKitHandler = async (req, res) => {
    try {
        const { patient_id, kit_id } = req.body;

        // Validation
        if (!patient_id && !kit_id) {
            return res.status(400).json({
                success: false,
                error: 'Either patient_id or kit_id must be provided'
            });
        }

        // Release kit via service (includes validation)
        const assignment = await releaseKit({ patient_id, kit_id });

        res.json({
            success: true,
            data: {
                assignment_id: assignment.assignment_id,
                patient_id: assignment.patient_id,
                kit_id: assignment.kit_id,
                assigned_at: assignment.assigned_at,
                unassigned_at: assignment.unassigned_at
            }
        });

    } catch (error) {
        console.error('Release kit error:', error);
        
        // Handle specific validation errors
        if (error.message.includes('No active assignment found')) {
            return res.status(404).json({
                success: false,
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get active assignment for a patient
 * GET /api/v1/assignments/patient/:patient_id
 */
const getPatientAssignmentHandler = async (req, res) => {
    try {
        const { patient_id } = req.params;

        const assignment = await getPatientActiveAssignment(patient_id);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: 'No active assignment found for this patient'
            });
        }

        res.json({
            success: true,
            data: assignment
        });

    } catch (error) {
        console.error('Get patient assignment error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

/**
 * Get active assignment for a kit
 * GET /api/v1/assignments/kit/:kit_id
 */
const getKitAssignmentHandler = async (req, res) => {
    try {
        const { kit_id } = req.params;

        const assignment = await getKitActiveAssignment(kit_id);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                error: 'No active assignment found for this kit'
            });
        }

        res.json({
            success: true,
            data: assignment
        });

    } catch (error) {
        console.error('Get kit assignment error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

module.exports = {
    assignKitHandler,
    releaseKitHandler,
    getPatientAssignmentHandler,
    getKitAssignmentHandler
};
