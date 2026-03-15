const pool = require('../config/db');

// Get all patients (with role-based filtering)
const getAllPatients = async (req, res) => {
  try {
    const { role, userId } = req.user;
    
    let query, params;
    
    if (role === 'Owner') {
      // Owner sees all patients
      query = `
        SELECT p.*, u.first_name || ' ' || u.last_name as therapist_name
        FROM patients p
        LEFT JOIN users u ON p.linked_therapist_id = u.user_id
        ORDER BY p.created_at DESC
      `;
      params = [];
    } else {
      // Therapists see only their own patients
      query = `
        SELECT p.*, u.first_name || ' ' || u.last_name as therapist_name
        FROM patients p
        LEFT JOIN users u ON p.linked_therapist_id = u.user_id
        WHERE p.linked_therapist_id = $1
        ORDER BY p.created_at DESC
      `;
      params = [userId];
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get patient by ID
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    
    let query, params;
    
    if (role === 'Owner') {
      // Owner can access any patient
      query = `
        SELECT p.*, u.first_name || ' ' || u.last_name as therapist_name
        FROM patients p
        LEFT JOIN users u ON p.linked_therapist_id = u.user_id
        WHERE p.id = $1
      `;
      params = [id];
    } else {
      // Therapists can only access their own patients
      query = `
        SELECT p.*, u.first_name || ' ' || u.last_name as therapist_name
        FROM patients p
        LEFT JOIN users u ON p.linked_therapist_id = u.user_id
        WHERE p.id = $1 AND p.linked_therapist_id = $2
      `;
      params = [id, userId];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Create new patient
const createPatient = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      age,
      address,
      medical_history,
      phobia_type = 'Flight',
      phobia_triggers,
      calming_factors
    } = req.body;
    
    const { userId } = req.user;
    
    // Validation
    if (!name || !age) {
      return res.status(400).json({
        success: false,
        error: 'Name and age are required'
      });
    }
    
    // Check for duplicate ID (if provided)
    const existingPatient = await pool.query(
      'SELECT id FROM patients WHERE id = $1',
      [req.body.id]
    );
    
    if (existingPatient.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID already exists'
      });
    }
    
    // Generate unique ID if not provided
    const patientId = req.body.id || `P${Date.now().toString().slice(-6)}`;
    
    const query = `
      INSERT INTO patients (
        id, name, phone, email, age, address, medical_history, 
        phobia_type, phobia_triggers, calming_factors, linked_therapist_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
    `;
    
    const values = [
      patientId,
      name,
      phone || null,
      email || null,
      parseInt(age),
      address || null,
      medical_history || null,
      phobia_type,
      phobia_triggers || null,
      calming_factors || null,
      userId
    ];
    
    await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: {
        id: patientId,
        message: 'Patient created successfully'
      }
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient
};
