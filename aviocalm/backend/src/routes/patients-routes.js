const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth-middleware');
const { 
  getAllPatients, 
  getPatientById, 
  createPatient,
  updatePatient,
  updatePatientStatus,
  markSessionsAsRead,
  completeSession,
  getPatientSessions,
  getSessionAnalytics,
  getSessionAlerts
} = require('../controllers/patients-controller');

// All patient routes require authentication
router.use(authenticateToken);

// GET /api/patients - Get all patients (role-based)
router.get('/', getAllPatients);

// GET /api/patients/:id - Get patient by ID (role-based)
router.get('/:id', getPatientById);

// POST /api/patients - Create new patient
router.post('/', createPatient);

// PUT /api/patients/:id - Update patient by ID (role-based)
router.put('/:id', updatePatient);

// PUT /api/patients/:id/status - Update patient status inline (Active | Inactive | Discharged)
router.put('/:id/status', updatePatientStatus);

// PUT /api/patients/:id/sessions/read - Mark all completed sessions as reviewed
router.put('/:id/sessions/read', markSessionsAsRead);

// POST /api/sessions/:sessionId/complete - Complete session with HRV calculation
router.post('/sessions/:sessionId/complete', completeSession);

// GET /api/patients/:patientId/sessions - Get patient sessions list
router.get('/:patientId/sessions', getPatientSessions);

// GET /api/sessions/:sessionId/analytics - Get session analytics with downsampling
router.get('/sessions/:sessionId/analytics', getSessionAnalytics);

// GET /api/sessions/:sessionId/alerts - Get all alerts for a specific session
router.get('/sessions/:sessionId/alerts', getSessionAlerts);

module.exports = router;
