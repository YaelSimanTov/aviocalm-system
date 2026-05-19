const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth-middleware');
const { 
    assignKitHandler,
    releaseKitHandler,
    getPatientAssignmentHandler,
    getKitAssignmentHandler
} = require('../controllers/assignment-controller');

// All assignment routes require authentication
router.use(authenticateToken);

// POST /api/v1/assignments/assign - Assign a kit to a patient
router.post('/assign', assignKitHandler);

// PATCH /api/v1/assignments/release - Release a kit assignment
router.patch('/release', releaseKitHandler);

// GET /api/v1/assignments/patient/:patient_id - Get active assignment for a patient
router.get('/patient/:patient_id', getPatientAssignmentHandler);

// GET /api/v1/assignments/kit/:kit_id - Get active assignment for a kit
router.get('/kit/:kit_id', getKitAssignmentHandler);

module.exports = router;
