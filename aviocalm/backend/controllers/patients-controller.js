const pool = require('../config/db');

// Get all patients (with role-based filtering and search)
const getAllPatients = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { search } = req.query;
    
    let query, params;
    
    if (role === 'Owner') {
      // Owner sees all patients, with optional search
      if (search) {
        query = `
          SELECT id, full_name, national_id, phobia_type, created_at
          FROM patients 
          WHERE full_name ILIKE $1 OR national_id ILIKE $1
          ORDER BY full_name ASC
        `;
        params = [`%${search}%`];
      } else {
        query = `
          SELECT id, full_name, national_id, phobia_type, created_at
          FROM patients 
          ORDER BY full_name ASC
        `;
        params = [];
      }
    } else {
      // Therapists see only their own patients, with optional search
      if (search) {
        query = `
          SELECT id, full_name, national_id, phobia_type, created_at
          FROM patients 
          WHERE therapist_id = $1 AND (full_name ILIKE $2 OR national_id ILIKE $2)
          ORDER BY full_name ASC
        `;
        params = [userId, `%${search}%`];
      } else {
        query = `
          SELECT id, full_name, national_id, phobia_type, created_at
          FROM patients 
          WHERE therapist_id = $1
          ORDER BY full_name ASC
        `;
        params = [userId];
      }
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
        LEFT JOIN users u ON p.therapist_id = u.user_id
        WHERE p.id = $1
      `;
      params = [id];
    } else {
      // Therapists can only access their own patients
      query = `
        SELECT p.*, u.first_name || ' ' || u.last_name as therapist_name
        FROM patients p
        LEFT JOIN users u ON p.therapist_id = u.user_id
        WHERE p.id = $1 AND p.therapist_id = $2
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
    
    const patientData = result.rows[0];
    
    // Append empty arrays for treatment history and appointments
    // These will be populated when the respective tables are created
    const response = {
      ...patientData,
      treatmentHistory: [],
      appointments: []
    };
    
    res.json({
      success: true,
      data: response
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
      national_id,
      full_name,
      phone,
      email,
      date_of_birth,
      address,
      medical_history,
      phobia_type = 'Flight',
      phobia_triggers,
      calming_factors,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;
    
    const { userId, role } = req.user;
    
    // Role-based access control
    if (role !== 'Therapist') {
      return res.status(403).json({
        success: false,
        error: 'Only Therapists can create patients'
      });
    }
    
    // Validation
    if (!national_id || !full_name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'National ID, full name, and phone are required'
      });
    }
    
    // Check for duplicate national_id
    const existingPatient = await pool.query(
      'SELECT national_id FROM patients WHERE national_id = $1',
      [national_id]
    );
    
    if (existingPatient.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Patient with this National ID already exists'
      });
    }
    
    const query = `
      INSERT INTO patients (
        national_id, full_name, phone, email, date_of_birth, address, medical_history, 
        phobia_type, phobia_triggers, calming_factors, 
        emergency_contact_name, emergency_contact_phone, therapist_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
    `;
    
    const values = [
      national_id,
      full_name,
      phone || null,
      email || null,
      date_of_birth || null,
      address || null,
      medical_history || null,
      phobia_type,
      phobia_triggers || null,
      calming_factors || null,
      emergency_contact_name || null,
      emergency_contact_phone || null,
      userId
    ];
    
    await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: {
        national_id: national_id,
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
