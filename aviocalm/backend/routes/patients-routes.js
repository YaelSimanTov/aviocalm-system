const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth-middleware');
const { 
  getAllPatients, 
  getPatientById, 
  createPatient 
} = require('../controllers/patients-controller');

// All patient routes require authentication
router.use(authenticateToken);

// GET /api/patients - Get all patients (role-based)
router.get('/', getAllPatients);

// GET /api/patients/:id - Get patient by ID (role-based)
router.get('/:id', getPatientById);

// POST /api/patients - Create new patient
router.post('/', createPatient);

module.exports = router;
