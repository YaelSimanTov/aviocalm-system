const pool = require('../config/db');
const { completeSessionWithHRV, getVrEventsBySession } = require('../db/db-manager');

// Get all patients (with role-based filtering and search)
const getAllPatients = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { search } = req.query;
    
    let query, params;
    
    // Subquery that returns true when the patient has at least one completed, unreviewed session
    const unreadSubquery = `
      EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.patient_id = p.id
          AND s.status = 'Completed'
          AND s.is_reviewed = false
      )`;

    if (role === 'Owner') {
      // Owner sees all patients, with optional search
      if (search) {
        query = `
          SELECT p.id, p.full_name, p.national_id, p.phobia_type, p.status, p.created_at,
                 ${unreadSubquery} AS has_unread_sessions
          FROM patients p
          WHERE p.full_name ILIKE $1 OR p.national_id ILIKE $1
          ORDER BY p.full_name ASC
        `;
        params = [`%${search}%`];
      } else {
        query = `
          SELECT p.id, p.full_name, p.national_id, p.phobia_type, p.status, p.created_at,
                 ${unreadSubquery} AS has_unread_sessions
          FROM patients p
          ORDER BY p.full_name ASC
        `;
        params = [];
      }
    } else {
      // Therapists see only their own patients, with optional search
      if (search) {
        query = `
          SELECT p.id, p.full_name, p.national_id, p.phobia_type, p.status, p.created_at,
                 ${unreadSubquery} AS has_unread_sessions
          FROM patients p
          WHERE p.therapist_id = $1 AND (p.full_name ILIKE $2 OR p.national_id ILIKE $2)
          ORDER BY p.full_name ASC
        `;
        params = [userId, `%${search}%`];
      } else {
        query = `
          SELECT p.id, p.full_name, p.national_id, p.phobia_type, p.status, p.created_at,
                 ${unreadSubquery} AS has_unread_sessions
          FROM patients p
          WHERE p.therapist_id = $1
          ORDER BY p.full_name ASC
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
        SELECT p.id, p.national_id, p.full_name, p.phone, p.email,
               TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
               p.address, p.medical_history, p.phobia_type, p.phobia_triggers,
               p.calming_factors, p.emergency_contact_name, p.emergency_contact_phone,
               p.therapist_id, p.status, p.created_at, p.updated_at,
               u.first_name || ' ' || u.last_name AS therapist_name
        FROM patients p
        LEFT JOIN users u ON p.therapist_id = u.user_id
        WHERE p.id = $1
      `;
      params = [id];
    } else {
      // Therapists can only access their own patients
      query = `
        SELECT p.id, p.national_id, p.full_name, p.phone, p.email,
               TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
               p.address, p.medical_history, p.phobia_type, p.phobia_triggers,
               p.calming_factors, p.emergency_contact_name, p.emergency_contact_phone,
               p.therapist_id, p.status, p.created_at, p.updated_at,
               u.first_name || ' ' || u.last_name AS therapist_name
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

    if (date_of_birth) {
      const today = new Date().toISOString().split('T')[0];
      const dobOnly = date_of_birth.split('T')[0];
      if (dobOnly > today) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth cannot be in the future'
        });
      }
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
      date_of_birth ? date_of_birth.split('T')[0] : null,
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
    const dobClean = date_of_birth ? date_of_birth.split('T')[0] : null;
    
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
    
    if (date_of_birth) {
      const today = new Date().toISOString().split('T')[0];
      const dobOnly = date_of_birth.split('T')[0];
      if (dobOnly > today) {
        return res.status(400).json({
          success: false,
          error: 'Date of birth cannot be in the future'
        });
      }
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
      dobClean,
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
      SELECT p.id, p.national_id, p.full_name, p.phone, p.email,
             TO_CHAR(p.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
             p.address, p.medical_history, p.phobia_type, p.phobia_triggers,
             p.calming_factors, p.emergency_contact_name, p.emergency_contact_phone,
             p.therapist_id, p.status, p.created_at, p.updated_at,
             u.first_name || ' ' || u.last_name AS therapist_name
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
    
    // Query sessions for patient with difficulty levels and review state
    const sessionsQuery = `
      SELECT 
        s.id,
        s.started_at,
        s.duration_minutes,
        s.overall_hrv_rmssd,
        s.status,
        s.is_reviewed,
        COALESCE(
          json_agg(DISTINCT ap.difficulty) FILTER (WHERE ap.difficulty IS NOT NULL),
          '[]'::json
        ) as difficulties
      FROM sessions s
      LEFT JOIN anxiety_profiles ap ON s.id = ap.session_id
      WHERE s.patient_id = $1
      GROUP BY s.id, s.started_at, s.duration_minutes, s.overall_hrv_rmssd, s.status, s.is_reviewed
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
    
    // Fetch raw anxiety profiles data (spo2 included so processWindow can average it)
    const rawDataQuery = `
      SELECT 
        recorded_at,
        vr_state,
        difficulty,
        heart_rate,
        stress_score,
        spo2
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
          precomputedKPIs: {
            avg_heart_rate:    null,
            avg_spo2:          null,
            avg_stress_score:  null,
            total_data_points: 0,
          },
          timeInRangeDistribution: { relaxed: 0, moderate: 0, panic: 0 },
        }
      });
    }

    // Downsample raw data into 30-second windows for the time-series chart only
    const timeSeriesData = downsampleData(rawData, 30000);

    // Fetch pre-computed KPI aggregates written to the sessions table at session close.
    // These replace the former on-the-fly calculateTimeInRange / reduce operations.
    const kpiResult = await pool.query(
      `SELECT avg_heart_rate, avg_spo2, avg_stress_score,
              time_relaxed_percent, time_moderate_percent, time_panic_percent,
              total_data_points
       FROM sessions WHERE id = $1`,
      [sessionId]
    );
    const kpi = kpiResult.rows[0] ?? {};
    // Diagnostic log: surface any NULL columns that indicate computeAndSaveSessionKPIs
    // was not called at session close (missing data will render as N/A on the frontend)
    console.log(`[ANALYTICS] KPIs read from DB for session ${sessionId}:`, JSON.stringify(kpi));

    res.json({
      success: true,
      data: {
        timeSeriesData,
        precomputedKPIs: {
          avg_heart_rate:    kpi.avg_heart_rate    ?? null,
          avg_spo2:          kpi.avg_spo2          ?? null,
          avg_stress_score:  kpi.avg_stress_score  != null ? parseFloat(kpi.avg_stress_score) : null,
          total_data_points: kpi.total_data_points ?? 0,
        },
        timeInRangeDistribution: {
          relaxed:  kpi.time_relaxed_percent  ?? 0,
          moderate: kpi.time_moderate_percent ?? 0,
          panic:    kpi.time_panic_percent    ?? 0,
        },
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
  const avgHeartRate  = windowData.reduce((sum, point) => sum + (point.heart_rate   || 0), 0) / windowData.length;
  const avgStressScore = windowData.reduce((sum, point) => sum + (point.stress_score || 0), 0) / windowData.length;
  const avgSpo2       = windowData.reduce((sum, point) => sum + (point.spo2         || 0), 0) / windowData.length;

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
    timestamp:      windowData[0].recorded_at,
    avgHeartRate:   Math.round(avgHeartRate),
    avgStressScore: Math.round(avgStressScore),
    avgSpo2:        Math.round(avgSpo2),
    vrState:        dominantVrState,
    difficulty:     windowData[0].difficulty,
    dataPoints:     windowData.length
  };
}

// Mark all completed sessions for a patient as reviewed (clears the unread indicator)
const markSessionsAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    // Verify the patient exists and the requesting user has access
    const checkQuery = role === 'Owner'
      ? 'SELECT id FROM patients WHERE id = $1'
      : 'SELECT id FROM patients WHERE id = $1 AND therapist_id = $2';
    const checkParams = role === 'Owner' ? [id] : [id, userId];

    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or access denied'
      });
    }

    await pool.query(
      `UPDATE sessions
         SET is_reviewed = true
       WHERE patient_id = $1
         AND status = 'Completed'
         AND is_reviewed = false`,
      [id]
    );

    res.json({
      success: true,
      message: 'Sessions marked as reviewed'
    });
  } catch (error) {
    console.error('Error marking sessions as read:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update patient status (inline edit from table)
const updatePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const VALID_STATUSES = ['Active', 'Inactive', 'Discharged'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const { role, userId } = req.user;

    // Verify the patient exists and the requesting user has access to it
    const checkQuery = role === 'Owner'
      ? 'SELECT id FROM patients WHERE id = $1'
      : 'SELECT id FROM patients WHERE id = $1 AND therapist_id = $2';
    const checkParams = role === 'Owner' ? [id] : [id, userId];

    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or access denied'
      });
    }

    const result = await pool.query(
      'UPDATE patients SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status',
      [status, id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: `Patient status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating patient status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// GET /api/patients/sessions/:sessionId/alerts
// Returns session alerts together with pre-computed session-level statistics:
//   alerts       – ordered list of all breach records for the session
//   baseline_hr  – the real resting HR value calibrated at session start
//                  (sourced from patient_baselines, NULL when not yet calibrated)
//   total_points – raw biometric record count (one row per anxiety_profiles entry)
//   window_count – number of downsampled 30-second chart windows (matches timeSeriesData.length)
const getSessionAlerts = async (req, res) => {
  const { sessionId } = req.params;
  try {
    // 1. All alerts for this session in chronological order
    const alertsResult = await pool.query(
      `SELECT id, patient_id, session_id, timestamp, duration_seconds,
              alert_type, description, is_read, created_at
       FROM alerts
       WHERE session_id = $1
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    // 2. Real resting baseline HR calibrated at the start of this specific session
    const baselineResult = await pool.query(
      `SELECT pb.avg_resting_hr AS baseline_hr
       FROM patient_baselines pb
       WHERE pb.session_id = $1
       LIMIT 1`,
      [sessionId]
    );

    // 3. Pre-computed total_data_points from the sessions table (written at session close).
    // This replaces the former live COUNT(*) on anxiety_profiles.
    const sessionKpiResult = await pool.query(
      `SELECT total_data_points FROM sessions WHERE id = $1`,
      [sessionId]
    );

    const baseline_hr  = baselineResult.rows[0]?.baseline_hr         ?? null;
    const total_points = sessionKpiResult.rows[0]?.total_data_points  ?? 0;

    // Derive window_count by running the same downsampleData function used by
    // getSessionAnalytics — guarantees this stat always matches the chart's
    // data point count rather than relying on an assumed raw-to-window ratio.
    const rawForWindows = await pool.query(
      `SELECT recorded_at, vr_state, difficulty, heart_rate, stress_score, spo2
       FROM anxiety_profiles WHERE session_id = $1 ORDER BY recorded_at ASC`,
      [sessionId]
    );
    const window_count = downsampleData(rawForWindows.rows, 30000).length;

    res.json({
      success: true,
      data: {
        alerts: alertsResult.rows,
        baseline_hr,
        total_points,
        window_count,
      },
    });
  } catch (err) {
    console.error('[PATIENTS] Failed to fetch session alerts:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch session alerts' });
  }
};

// GET /api/patients/:id/notes - Get all clinical notes for a specific patient
const getPatientClinicalNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, userId } = req.user;

    // Verify patient exists and user has access
    let checkQuery, checkParams;
    
    if (role === 'Owner') {
      checkQuery = 'SELECT id FROM patients WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT id FROM patients WHERE id = $1 AND therapist_id = $2';
      checkParams = [id, userId];
    }

    const patientCheck = await pool.query(checkQuery, checkParams);

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or access denied'
      });
    }

    // Fetch all clinical notes for the patient, ordered by created_at DESC (newest first)
    const notesQuery = `
      SELECT id, patient_id, note_content, created_at
      FROM clinical_notes
      WHERE patient_id = $1
      ORDER BY created_at DESC
    `;

    const result = await pool.query(notesQuery, [id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching clinical notes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// POST /api/patients/:id/notes - Create a new clinical note for a specific patient
const createClinicalNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note_content } = req.body;
    const { role, userId } = req.user;

    // Verify patient exists and user has access
    let checkQuery, checkParams;
    
    if (role === 'Owner') {
      checkQuery = 'SELECT id FROM patients WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT id FROM patients WHERE id = $1 AND therapist_id = $2';
      checkParams = [id, userId];
    }

    const patientCheck = await pool.query(checkQuery, checkParams);

    if (patientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found or access denied'
      });
    }

    // Validate note content
    if (!note_content || note_content.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Note content is required'
      });
    }

    // Insert the new clinical note
    const insertQuery = `
      INSERT INTO clinical_notes (patient_id, note_content)
      VALUES ($1, $2)
      RETURNING id, patient_id, note_content, created_at
    `;

    const result = await pool.query(insertQuery, [id, note_content.trim()]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Clinical note created successfully'
    });
  } catch (error) {
    console.error('Error creating clinical note:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// GET /api/patients/sessions/:sessionId/vr-events
const getVrEventsHandler = async (req, res) => {
  const { sessionId } = req.params;
  try {
    const events = await getVrEventsBySession(sessionId);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error('[VR EVENTS] Failed to fetch events for session', sessionId, error);
    res.status(500).json({ success: false, error: 'Failed to fetch VR events' });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  updatePatientStatus,
  markSessionsAsRead,
  completeSession,
  getPatientSessions,
  getSessionAnalytics,
  getSessionAlerts,
  getPatientClinicalNotes,
  createClinicalNote,
  getVrEventsHandler
};
