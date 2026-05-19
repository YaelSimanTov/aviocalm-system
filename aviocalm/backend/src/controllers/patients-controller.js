const pool = require('../config/db');
const { completeSessionWithHRV } = require('../db/dbManager');

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
      RETURNING id, national_id, full_name
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
    
    const insertResult = await pool.query(query, values);
    const newPatient = insertResult.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        id: newPatient.id,
        national_id: newPatient.national_id,
        full_name: newPatient.full_name,
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

// Update patient by ID
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;
    const {
      national_id,
      full_name,
      phone,
      email,
      date_of_birth,
      address,
      medical_history,
      phobia_type,
      phobia_triggers,
      calming_factors,
      emergency_contact_name,
      emergency_contact_phone
    } = req.body;
    
    // First check if patient exists and user has access
    let checkQuery, checkParams;
    
    if (role === 'Owner') {
      checkQuery = 'SELECT id, therapist_id FROM patients WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT id, therapist_id FROM patients WHERE id = $1 AND therapist_id = $2';
      checkParams = [id, userId];
    }
    
    const existingPatient = await pool.query(checkQuery, checkParams);
    
    if (existingPatient.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or access denied'
      });
    }
    
    // Check for duplicate national_id (if changed)
    if (national_id && national_id !== existingPatient.rows[0].national_id) {
      const duplicateCheck = await pool.query(
        'SELECT id FROM patients WHERE national_id = $1 AND id != $2',
        [national_id, id]
      );
      
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Patient with this National ID already exists'
        });
      }
    }
    
    // Update the patient (National ID excluded to maintain data integrity)
    const updateQuery = `
      UPDATE patients SET 
        full_name = $1,
        phone = $2,
        email = $3,
        date_of_birth = $4,
        address = $5,
        medical_history = $6,
        phobia_type = $7,
        phobia_triggers = $8,
        calming_factors = $9,
        emergency_contact_name = $10,
        emergency_contact_phone = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
    `;
    
    const updateValues = [
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
      id
    ];
    
    await pool.query(updateQuery, updateValues);
    
    // Fetch updated patient data
    const updatedPatientQuery = `
      SELECT p.*, u.first_name || ' ' || u.last_name as therapist_name
      FROM patients p
      LEFT JOIN users u ON p.therapist_id = u.user_id
      WHERE p.id = $1
    `;
    
    const updatedResult = await pool.query(updatedPatientQuery, [id]);
    
    res.json({
      success: true,
      data: {
        ...updatedResult.rows[0],
        treatmentHistory: [],
        appointments: []
      }
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Complete session with HRV calculation
const completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role, userId } = req.user;
    const { durationMinutes, status = 'Completed' } = req.body;
    
    // First verify session exists and user has access
    const sessionCheck = await pool.query(
      'SELECT s.id, s.patient_id, p.therapist_id FROM sessions s JOIN patients p ON s.patient_id = p.id WHERE s.id = $1',
      [sessionId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const sessionData = sessionCheck.rows[0];
    
    // Check access permissions
    if (role !== 'Owner' && sessionData.therapist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Complete the session with automatic HRV calculation
    const completionData = {
      endedAt: new Date().toISOString(),
      durationMinutes: durationMinutes,
      status: status
    };
    
    const success = await completeSessionWithHRV(sessionId, completionData);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to complete session'
      });
    }
    
    // Fetch the updated session data to return
    const updatedSessionQuery = `
      SELECT 
        id,
        started_at,
        ended_at,
        duration_minutes,
        overall_hrv_rmssd,
        status
      FROM sessions 
      WHERE id = $1
    `;
    
    const updatedSession = await pool.query(updatedSessionQuery, [sessionId]);
    
    res.json({
      success: true,
      data: updatedSession.rows[0],
      message: 'Session completed successfully with HRV calculation'
    });
    
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get patient sessions list
const getPatientSessions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { role, userId } = req.user;
    
    // First verify patient exists and user has access
    let checkQuery, checkParams;
    
    if (role === 'Owner') {
      checkQuery = 'SELECT id FROM patients WHERE id = $1';
      checkParams = [patientId];
    } else {
      checkQuery = 'SELECT id FROM patients WHERE id = $1 AND therapist_id = $2';
      checkParams = [patientId, userId];
    }
    
    const patientCheck = await pool.query(checkQuery, checkParams);
    
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or access denied'
      });
    }
    
    // Query sessions for patient with difficulty levels
    const sessionsQuery = `
      SELECT 
        s.id,
        s.started_at,
        s.duration_minutes,
        s.overall_hrv_rmssd,
        s.status,
        COALESCE(
          json_agg(DISTINCT ap.difficulty) FILTER (WHERE ap.difficulty IS NOT NULL),
          '[]'::json
        ) as difficulties
      FROM sessions s
      LEFT JOIN anxiety_profiles ap ON s.id = ap.session_id
      WHERE s.patient_id = $1
      GROUP BY s.id, s.started_at, s.duration_minutes, s.overall_hrv_rmssd, s.status
      ORDER BY s.started_at DESC
    `;
    
    const result = await pool.query(sessionsQuery, [patientId]);
    
    // Debug: Log the results to verify difficulties array
    console.log('Sessions query result for patient', patientId, ':', result.rows.map(row => ({
      id: row.id,
      difficulties: row.difficulties,
      difficultiesType: typeof row.difficulties,
      difficultiesLength: Array.isArray(row.difficulties) ? row.difficulties.length : 'not array'
    })));
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching patient sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get session analytics with downsampling
const getSessionAnalytics = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // First verify session exists
    const sessionCheck = await pool.query(
      'SELECT s.id, s.patient_id, p.therapist_id FROM sessions s JOIN patients p ON s.patient_id = p.id WHERE s.id = $1',
      [sessionId]
    );
    
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    const sessionData = sessionCheck.rows[0];
    const { role, userId } = req.user;
    
    // Check access permissions
    if (role !== 'Owner' && sessionData.therapist_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Fetch raw anxiety profiles data
    const rawDataQuery = `
      SELECT 
        recorded_at,
        vr_state,
        difficulty,
        heart_rate,
        stress_score
      FROM anxiety_profiles 
      WHERE session_id = $1
      ORDER BY recorded_at ASC
    `;
    
    const rawDataResult = await pool.query(rawDataQuery, [sessionId]);
    const rawData = rawDataResult.rows;
    
    if (rawData.length === 0) {
      return res.json({
        success: true,
        data: {
          timeSeriesData: [],
          timeInRangeDistribution: {
            relaxed: 0,
            moderate: 0,
            panic: 0
          }
        }
      });
    }
    
    // Downsample data into 30-second windows
    const timeSeriesData = downsampleData(rawData, 30000); // 30 seconds in milliseconds
    
    // Calculate time-in-range distribution
    const timeInRangeDistribution = calculateTimeInRange(rawData);
    
    res.json({
      success: true,
      data: {
        timeSeriesData,
        timeInRangeDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching session analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Helper function to downsample data into time windows
function downsampleData(data, windowSizeMs) {
  if (!data || data.length === 0) return [];
  
  const downsampled = [];
  const startTime = new Date(data[0].recorded_at).getTime();
  
  let currentWindow = Math.floor((new Date(data[0].recorded_at).getTime() - startTime) / windowSizeMs);
  let windowData = [];
  
  for (const point of data) {
    const pointTime = new Date(point.recorded_at).getTime();
    const window = Math.floor((pointTime - startTime) / windowSizeMs);
    
    if (window !== currentWindow) {
      // Process previous window
      if (windowData.length > 0) {
        downsampled.push(processWindow(windowData));
      }
      
      // Start new window
      currentWindow = window;
      windowData = [point];
    } else {
      windowData.push(point);
    }
  }
  
  // Process last window
  if (windowData.length > 0) {
    downsampled.push(processWindow(windowData));
  }
  
  return downsampled;
}

// Helper function to process a window of data
function processWindow(windowData) {
  const avgHeartRate = windowData.reduce((sum, point) => sum + (point.heart_rate || 0), 0) / windowData.length;
  const avgStressScore = windowData.reduce((sum, point) => sum + (point.stress_score || 0), 0) / windowData.length;
  
  // Find dominant VR state (most frequent)
  const vrStateCounts = {};
  let dominantVrState = windowData[0].vr_state;
  let maxCount = 0;
  
  for (const point of windowData) {
    const state = point.vr_state;
    vrStateCounts[state] = (vrStateCounts[state] || 0) + 1;
    if (vrStateCounts[state] > maxCount) {
      maxCount = vrStateCounts[state];
      dominantVrState = state;
    }
  }
  
  return {
    timestamp: windowData[0].recorded_at,
    avgHeartRate: Math.round(avgHeartRate),
    avgStressScore: Math.round(avgStressScore),
    vrState: dominantVrState,
    difficulty: windowData[0].difficulty,
    dataPoints: windowData.length
  };
}

// Helper function to calculate time-in-range distribution
function calculateTimeInRange(data) {
  if (!data || data.length === 0) {
    return { relaxed: 0, moderate: 0, panic: 0 };
  }
  
  let relaxedTime = 0;
  let moderateTime = 0;
  let panicTime = 0;
  
  for (let i = 0; i < data.length - 1; i++) {
    const currentPoint = data[i];
    const nextPoint = data[i + 1];
    const stressScore = currentPoint.stress_score || 0;
    
    // Calculate time duration between points (in seconds)
    const currentTime = new Date(currentPoint.recorded_at).getTime();
    const nextTime = new Date(nextPoint.recorded_at).getTime();
    const duration = (nextTime - currentTime) / 1000; // Convert to seconds
    
    // Categorize based on stress score
    if (stressScore < 40) {
      relaxedTime += duration;
    } else if (stressScore <= 75) {
      moderateTime += duration;
    } else {
      panicTime += duration;
    }
  }
  
  const totalTime = relaxedTime + moderateTime + panicTime;
  
  return {
    relaxed: totalTime > 0 ? Math.round((relaxedTime / totalTime) * 100) : 0,
    moderate: totalTime > 0 ? Math.round((moderateTime / totalTime) * 100) : 0,
    panic: totalTime > 0 ? Math.round((panicTime / totalTime) * 100) : 0
  };
}

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  completeSession,
  getPatientSessions,
  getSessionAnalytics
};
