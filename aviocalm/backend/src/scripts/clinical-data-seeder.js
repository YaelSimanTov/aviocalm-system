/**
 * Clinical Data Seeder
 * Generates realistic test data for Treatment History functionality
 * Populates patients, sessions, and anxiety_profiles tables with time-series data
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aviocalm',
  password: 'postgres',
  port: 5433,
});

class ClinicalDataSeeder {
  constructor() {
    this.patientNationalId = '123456789';
    this.patientName = 'Test Patient';
    this.therapistId = null; // Will fetch from existing admin user
    this.vrStates = ['BoardingState', 'TakeOffState', 'InFlightState', 'LandingState', 'LandedState', 'PausedState'];
  }

  /**
   * Clear existing test data from all relevant tables
   */
  async clearExistingData() {
    console.log('[SEEDER] Clearing existing test data...');
    
    try {
      // Clear in correct order due to foreign key constraints
      await pool.query('DELETE FROM anxiety_profiles WHERE patient_id = $1', [this.patientNationalId]);
      await pool.query('DELETE FROM scene_stress_scores WHERE patient_id IN (SELECT id FROM patients WHERE national_id = $1)', [this.patientNationalId]);
      await pool.query('DELETE FROM sessions WHERE patient_id IN (SELECT id FROM patients WHERE national_id = $1)', [this.patientNationalId]);
      await pool.query('DELETE FROM patients WHERE national_id = $1', [this.patientNationalId]);
      
      console.log('[SEEDER] Existing data cleared successfully');
    } catch (error) {
      console.error('[SEEDER] Error clearing existing data:', error);
      throw error;
    }
  }

  /**
   * Get existing admin user to use as therapist
   */
  async getTherapistUser() {
    console.log('[SEEDER] Getting therapist user...');
    
    const query = 'SELECT user_id FROM users WHERE username = $1';
    const result = await pool.query(query, ['admin']);
    
    if (result.rows.length === 0) {
      throw new Error('Admin user not found. Please ensure the database is properly initialized.');
    }
    
    this.therapistId = result.rows[0].user_id;
    console.log(`[SEEDER] Using therapist ID: ${this.therapistId}`);
  }

  /**
   * Create a test patient
   */
  async createPatient() {
    console.log('[SEEDER] Creating test patient...');
    
    // Ensure we have a therapist ID
    if (!this.therapistId) {
      await this.getTherapistUser();
    }
    
    const patientId = uuidv4();
    const query = `
      INSERT INTO patients (
        id, national_id, full_name, phone, email, date_of_birth, 
        phobia_type, therapist_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
    
    const values = [
      patientId,
      this.patientNationalId,
      this.patientName,
      '+1234567890',
      'test.patient@aviocalm.com',
      '1990-05-15',
      'Flight',
      this.therapistId,
      'Active'
    ];
    
    const result = await pool.query(query, values);
    console.log(`[SEEDER] Patient created with ID: ${result.rows[0].id}`);
    
    return { id: result.rows[0].id, nationalId: this.patientNationalId };
  }

  /**
   * Create sessions for patient
   */
  async createSessions(patientId) {
    console.log('[SEEDER] Creating treatment sessions...');
    
    const sessions = [];
    const now = new Date();
    
    // Create 3 sessions in the past week
    const sessionConfigs = [
      { daysAgo: 7, duration: 15, hrvScore: 42.5 },
      { daysAgo: 4, duration: 30, hrvScore: 38.2 },
      { daysAgo: 2, duration: 25, hrvScore: 45.8 }
    ];

    for (const config of sessionConfigs) {
      const sessionId = uuidv4();
      const startedAt = new Date(now.getTime() - (config.daysAgo * 24 * 60 * 60 * 1000));
      const endedAt = new Date(startedAt.getTime() + (config.duration * 60 * 1000));
      
      const query = `
        INSERT INTO sessions (
          id, patient_id, started_at, ended_at, duration_minutes, 
          overall_hrv_rmssd, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const values = [
        sessionId,
        patientId,
        startedAt.toISOString(),
        endedAt.toISOString(),
        config.duration,
        config.hrvScore,
        'Completed'
      ];
      
      const result = await pool.query(query, values);
      sessions.push({
        id: sessionId,
        startedAt,
        duration: config.duration,
        hrvScore: config.hrvScore
      });
      
      console.log(`[SEEDER] Session created: ${config.duration}min, HRV: ${config.hrvScore}ms`);
    }
    
    return sessions;
  }

  /**
   * Generate realistic time-series data for a session
   */
  generateTimeSeriesData(session, patientId) {
    console.log(`[SEEDER] Generating time-series data for ${session.duration} minute session...`);
    
    const profiles = [];
    const currentTime = new Date(session.startedAt);
    const endTime = new Date(currentTime.getTime() + (session.duration * 60 * 1000));
    
    // Generate data point every 10 seconds
    const intervalMs = 10000;
    
    while (currentTime < endTime) {
      const elapsedMinutes = (currentTime.getTime() - session.startedAt.getTime()) / (60 * 1000);
      const dataPoint = this.generateDataPoint(currentTime, elapsedMinutes, session.duration);
      
      profiles.push({
        log_id: uuidv4(),
        patient_id: patientId, // Use national_id as per schema
        session_id: session.id,
        recorded_at: currentTime.toISOString(),
        vr_state: dataPoint.vrState,
        difficulty: dataPoint.difficulty,
        heart_rate: dataPoint.heartRate,
        stress_score: dataPoint.stressScore,
        spo2: dataPoint.spo2,
        therapist_action: 'None'
      });
      
      currentTime.setTime(currentTime.getTime() + intervalMs);
    }
    
    console.log(`[SEEDER] Generated ${profiles.length} data points for session`);
    return profiles;
  }

  /**
   * Generate a single realistic data point based on elapsed time
   */
  generateDataPoint(currentTime, elapsedMinutes, totalDuration) {
    let vrState, baseHeartRate, baseStress, difficulty;
    
    // Define VR state transitions based on elapsed time
    if (elapsedMinutes < 3) {
      // First 3 minutes: Boarding - calm baseline
      vrState = 'BoardingState';
      baseHeartRate = 75;
      baseStress = 30;
      difficulty = 'Easy';
    } else if (elapsedMinutes < 8) {
      // Next 5 minutes: Takeoff - high stress
      vrState = 'TakeOffState';
      baseHeartRate = 120;
      baseStress = 80;
      difficulty = 'Medium';
    } else if (elapsedMinutes < totalDuration - 2) {
      // Remaining time: InFlight - moderate stress
      vrState = 'InFlightState';
      baseHeartRate = 85;
      baseStress = 45;
      difficulty = 'Medium';
    } else {
      // Last 2 minutes: Landing - elevated stress
      vrState = 'LandingState';
      baseHeartRate = 95;
      baseStress = 60;
      difficulty = 'Medium';
    }
    
    // Add realistic fluctuations using Math.random()
    const heartRateVariation = (Math.random() - 0.5) * 20; // ±10 BPM variation
    const stressVariation = (Math.random() - 0.5) * 10; // ±5 stress variation
    
    const heartRate = Math.max(60, Math.min(160, baseHeartRate + heartRateVariation));
    const stressScore = Math.max(0, Math.min(100, baseStress + stressVariation));
    
    // SpO2 decreases slightly during high stress
    const spo2Base = vrState === 'TakeOffState' ? 96 : 98;
    const spo2Variation = (Math.random() - 0.5) * 2;
    const spo2 = Math.max(90, Math.min(100, spo2Base + spo2Variation));
    
    return {
      vrState,
      difficulty,
      heartRate: Math.round(heartRate),
      stressScore: Math.round(stressScore),
      spo2: Math.round(spo2)
    };
  }

  /**
   * Insert anxiety profiles data for all sessions
   */
  async insertAnxietyProfiles(sessions, patient) {
    console.log('[SEEDER] Inserting anxiety profiles data...');
    
    for (const session of sessions) {
      const profiles = this.generateTimeSeriesData(session, patient.nationalId);
      
      // Batch insert profiles for this session
      const values = profiles.map(profile => [
        profile.log_id,
        profile.patient_id,
        profile.session_id,
        profile.recorded_at,
        profile.vr_state,
        profile.difficulty,
        profile.heart_rate,
        profile.stress_score,
        profile.spo2,
        profile.therapist_action
      ]);
      
      const query = `
        INSERT INTO anxiety_profiles (
          log_id, patient_id, session_id, recorded_at, vr_state, 
          difficulty, heart_rate, stress_score, spo2, therapist_action
        ) VALUES ${values.map((_, index) => 
          `($${index * 10 + 1}, $${index * 10 + 2}, $${index * 10 + 3}, $${index * 10 + 4}, $${index * 10 + 5}, $${index * 10 + 6}, $${index * 10 + 7}, $${index * 10 + 8}, $${index * 10 + 9}, $${index * 10 + 10})`
        ).join(', ')}
      `;
      
      const flatValues = values.flat();
      await pool.query(query, flatValues);
      
      console.log(`[SEEDER] Inserted ${profiles.length} anxiety profiles for session`);
    }
  }

  /**
   * Generate some scene stress scores for additional analytics
   */
  async insertSceneStressScores(sessions, patientId) {
    console.log('[SEEDER] Inserting scene stress scores...');
    
    for (const session of sessions) {
      // Generate 3-5 scene records per session
      const sceneCount = Math.floor(Math.random() * 3) + 3;
      const sceneData = [];
      
      for (let i = 0; i < sceneCount; i++) {
        const sceneTime = new Date(session.startedAt.getTime() + (i * session.duration * 60 * 1000 / sceneCount));
        const vrState = this.vrStates[i % this.vrStates.length];
        const difficulty = ['None', 'Easy', 'Medium', 'Hard'][Math.floor(Math.random() * 4)];
        
        // Calculate metrics based on VR state
        let avgHeartRate, peakStressScore;
        switch (vrState) {
          case 'BoardingState':
            avgHeartRate = 70 + Math.random() * 10;
            peakStressScore = 20 + Math.random() * 20;
            break;
          case 'TakeOffState':
            avgHeartRate = 110 + Math.random() * 20;
            peakStressScore = 70 + Math.random() * 20;
            break;
          case 'InFlightState':
            avgHeartRate = 80 + Math.random() * 15;
            peakStressScore = 30 + Math.random() * 30;
            break;
          case 'LandingState':
            avgHeartRate = 90 + Math.random() * 20;
            peakStressScore = 50 + Math.random() * 30;
            break;
          case 'LandedState':
            avgHeartRate = 75 + Math.random() * 10;
            peakStressScore = 25 + Math.random() * 15;
            break;
          case 'PausedState':
            avgHeartRate = 70 + Math.random() * 5;
            peakStressScore = 15 + Math.random() * 10;
            break;
          default:
            avgHeartRate = 75 + Math.random() * 15;
            peakStressScore = 35 + Math.random() * 25;
        }
        
        const weightedScore = peakStressScore * (difficulty === 'Easy' ? 0.8 : difficulty === 'Hard' ? 1.2 : 1.0);
        
        sceneData.push({
          score_id: uuidv4(),
          session_id: session.id,
          patient_id: patientId,
          vr_state: vrState,
          difficulty: difficulty,
          avg_heart_rate: Math.round(avgHeartRate * 10) / 10,
          peak_stress_score: Math.round(peakStressScore * 10) / 10,
          calculated_weighted_score: Math.round(weightedScore * 10) / 10,
          recorded_at: sceneTime.toISOString()
        });
      }
      
      // Insert scene data
      const values = sceneData.map(scene => [
        scene.score_id, scene.session_id, scene.patient_id, scene.vr_state,
        scene.difficulty, scene.avg_heart_rate, scene.peak_stress_score,
        scene.calculated_weighted_score, scene.recorded_at
      ]);
      
      const query = `
        INSERT INTO scene_stress_scores (
          score_id, session_id, patient_id, vr_state, difficulty,
          avg_heart_rate, peak_stress_score, calculated_weighted_score, recorded_at
        ) VALUES ${values.map((_, index) => 
          `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}, $${index * 9 + 9})`
        ).join(', ')}
      `;
      
      const flatValues = values.flat();
      await pool.query(query, flatValues);
    }
    
    console.log('[SEEDER] Scene stress scores inserted successfully');
  }

  /**
   * Run the complete seeder process
   */
  async run() {
    console.log('[SEEDER] Starting clinical data seeder...');
    console.log('[SEEDER] This will populate the database with realistic test data for Treatment History');
    
    try {
      // Step 1: Clear existing data
      await this.clearExistingData();
      
      // Step 2: Create patient
      const patient = await this.createPatient();
      
      // Step 3: Create sessions
      const sessions = await this.createSessions(patient.id);
      
      // Step 4: Generate and insert time-series data
      await this.insertAnxietyProfiles(sessions, patient);
      
      // Step 5: Generate scene stress scores
      await this.insertSceneStressScores(sessions, patient.id);
      
      console.log('[SEEDER] ===== SEEDING COMPLETED SUCCESSFULLY =====');
      console.log(`[SEEDER] Created ${sessions.length} treatment sessions`);
      console.log(`[SEEDER] Patient: ${this.patientName} (ID: ${this.patientNationalId})`);
      console.log('[SEEDER] Time-series data generated with realistic VR state transitions');
      console.log('[SEEDER] Data is ready for Treatment History visualization');
      console.log('[SEEDER] ===============================================');
      
    } catch (error) {
      console.error('[SEEDER] Error during seeding:', error);
      throw error;
    } finally {
      await pool.end(); // Close database connection
    }
  }
}

// Run seeder if this file is executed directly
if (require.main === module) {
  const seeder = new ClinicalDataSeeder();
  seeder.run().catch(console.error);
}

module.exports = ClinicalDataSeeder;
