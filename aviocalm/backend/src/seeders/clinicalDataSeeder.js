/**
 * Clinical Data Seeder
 * Generates mock historical data for testing analytics features
 * Populates SceneStressScores table with realistic therapy session data
 */

const { v4: uuidv4 } = require('uuid');

class ClinicalDataSeeder {
  constructor() {
    this.mockPatientId = '550e8400-e29b-41d4-a716-446655440000'; // Mock patient UUID
    this.vrStates = ['Boarding', 'Takeoff', 'Cruising', 'Landing', 'Taxiing'];
    this.difficulties = ['Easy', 'Medium', 'Hard'];
  }

  /**
   * Generate realistic mock data for multiple therapy sessions
   * @param {number} sessionCount - Number of sessions to generate
   * @returns {Array} Generated session data
   */
  generateMockSessions(sessionCount = 8) {
    const sessions = [];
    const now = new Date();

    for (let i = 0; i < sessionCount; i++) {
      const sessionDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)); // Each session 1 day apart
      const sessionId = uuidv4();
      
      // Generate 3-5 scenes per session
      const sceneCount = Math.floor(Math.random() * 3) + 3; // 3-5 scenes
      
      for (let j = 0; j < sceneCount; j++) {
        const sceneData = this.generateMockScene(sessionId, sessionDate, j);
        sessions.push(sceneData);
      }
    }

    return sessions;
  }

  /**
   * Generate mock data for a single VR scene
   * @param {string} sessionId - Session identifier
   * @param {Date} sessionDate - Date of the session
   * @param {number} sceneIndex - Index of the scene in the session
   * @returns {Object} Mock scene data
   */
  generateMockScene(sessionId, sessionDate, sceneIndex) {
    const vrState = this.vrStates[sceneIndex % this.vrStates.length];
    const difficulty = this.difficulties[Math.floor(Math.random() * this.difficulties.length)];
    
    // Generate realistic biometric data based on VR state and difficulty
    const baseMetrics = this.getBaseMetricsForVrState(vrState);
    const difficultyMultiplier = this.getDifficultyMultiplier(difficulty);
    
    // Add some randomization
    const randomization = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    
    const avgHeartRate = baseMetrics.avgHeartRate * difficultyMultiplier * randomization;
    const peakStressScore = baseMetrics.peakStressScore * difficultyMultiplier * randomization;
    
    // Calculate weighted score using the same algorithm as the service
    const calculatedWeightedScore = this.calculateWeightedScore(
      avgHeartRate,
      peakStressScore,
      vrState,
      difficulty
    );

    // Scene time (scenes happen sequentially within a session)
    const sceneTime = new Date(sessionDate.getTime() + (sceneIndex * 10 * 60 * 1000)); // 10 minutes between scenes

    return {
      ScoreID: uuidv4(),
      SessionID: sessionId,
      PatientID: this.mockPatientId,
      VrState: vrState,
      Difficulty: difficulty,
      AvgHeartRate: Math.round(avgHeartRate * 10) / 10, // Round to 1 decimal
      PeakStressScore: Math.round(peakStressScore * 10) / 10, // Round to 1 decimal
      CalculatedWeightedScore: Math.round(calculatedWeightedScore * 10) / 10, // Round to 1 decimal
      RecordedAt: sceneTime.toISOString()
    };
  }

  /**
   * Get base metrics for different VR states
   * @param {string} vrState - VR state
   * @returns {Object} Base metrics for the VR state
   */
  getBaseMetricsForVrState(vrState) {
    const baseMetrics = {
      'Boarding': { avgHeartRate: 75, peakStressScore: 25 },
      'Takeoff': { avgHeartRate: 95, peakStressScore: 65 },
      'Cruising': { avgHeartRate: 80, peakStressScore: 35 },
      'Landing': { avgHeartRate: 105, peakStressScore: 75 },
      'Taxiing': { avgHeartRate: 85, peakStressScore: 45 }
    };

    return baseMetrics[vrState] || { avgHeartRate: 80, peakStressScore: 40 };
  }

  /**
   * Get difficulty multiplier for stress levels
   * @param {string} difficulty - Difficulty level
   * @returns {number} Multiplier factor
   */
  getDifficultyMultiplier(difficulty) {
    const multipliers = {
      'Easy': 0.8,      // Lower stress in easy mode
      'Medium': 1.0,    // Normal stress
      'Hard': 1.3       // Higher stress in hard mode
    };

    return multipliers[difficulty] || 1.0;
  }

  /**
   * Calculate weighted score (simplified version of service algorithm)
   * @param {number} avgHeartRate - Average heart rate
   * @param {number} peakStressScore - Peak stress score
   * @param {string} vrState - VR state
   * @param {string} difficulty - Difficulty level
   * @returns {number} Weighted score
   */
  calculateWeightedScore(avgHeartRate, peakStressScore, vrState, difficulty) {
    // Base score from peak stress
    let baseScore = peakStressScore;

    // Apply difficulty weight
    const difficultyWeights = { 'Easy': 0.9, 'Medium': 1.0, 'Hard': 0.85 };
    baseScore *= difficultyWeights[difficulty] || 1.0;

    // Apply VR state weight
    const vrStateWeights = { 
      'Boarding': 0.8, 'Takeoff': 1.2, 'Cruising': 1.0, 
      'Landing': 1.3, 'Taxiing': 0.9 
    };
    baseScore *= vrStateWeights[vrState] || 1.0;

    // Add heart rate contribution
    if (avgHeartRate > 100) {
      const hrExcess = avgHeartRate - 100;
      baseScore += (hrExcess / 80) * 20; // 0-20 points for excess HR
    }

    return Math.max(0, Math.min(100, baseScore));
  }

  /**
   * Generate SQL insert statements for the mock data
   * @param {Array} sessions - Generated session data
   * @returns {string} SQL insert statements
   */
  generateSQLInserts(sessions) {
    let sql = '-- Clinical Data Seeder - Mock Historical Data\n';
    sql += '-- Generated for Patient Insights testing\n\n';

    sql += `-- Mock Patient (if not exists)\n`;
    sql += `INSERT INTO patients (id, national_id, full_name, therapist_id, status) VALUES \n`;
    sql += `('${this.mockPatientId}', '123456789', 'John Doe', '550e8400-e29b-41d4-a716-446655440001', 'Active') \n`;
    sql += `ON CONFLICT (id) DO NOTHING;\n\n`;

    sql += `-- Scene Stress Scores Data\n`;
    sql += `INSERT INTO scene_stress_scores \n`;
    sql += `(ScoreID, SessionID, PatientID, VrState, Difficulty, AvgHeartRate, PeakStressScore, CalculatedWeightedScore, RecordedAt) VALUES\n`;

    const values = sessions.map(session => 
      `('${session.ScoreID}', '${session.SessionID}', '${session.PatientID}', '${session.VrState}', '${session.Difficulty}', ${session.AvgHeartRate}, ${session.PeakStressScore}, ${session.CalculatedWeightedScore}, '${session.RecordedAt}')`
    );

    sql += values.join(',\n');
    sql += ';\n\n';

    // Generate some anxiety_profiles data as well
    sql += `-- Sample Anxiety Profiles Data\n`;
    sql += `INSERT INTO anxiety_profiles \n`;
    sql += `(LogID, SessionID, RecordedAt, VrState, Difficulty, HeartRate, StressScore, SpO2, TherapistAction) VALUES\n`;

    const profileData = this.generateSampleAnxietyProfiles(sessions);
    const profileValues = profileData.map(profile =>
      `('${profile.LogID}', '${profile.SessionID}', '${profile.RecordedAt}', '${profile.VrState}', '${profile.Difficulty}', ${profile.HeartRate}, ${profile.StressScore}, ${profile.SpO2}, '${profile.TherapistAction}')`
    );

    sql += profileValues.join(',\n');
    sql += ';\n';

    return sql;
  }

  /**
   * Generate sample anxiety profiles data
   * @param {Array} sessions - Session data
   * @returns {Array} Sample anxiety profile records
   */
  generateSampleAnxietyProfiles(sessions) {
    const profiles = [];
    
    // Generate 2-3 profile records per session
    sessions.forEach(session => {
      const recordCount = Math.floor(Math.random() * 2) + 2; // 2-3 records
      
      for (let i = 0; i < recordCount; i++) {
        const recordTime = new Date(session.RecordedAt);
        recordTime.setMinutes(recordTime.getMinutes() + (i * 3)); // 3 minutes apart
        
        profiles.push({
          LogID: uuidv4(),
          SessionID: session.SessionID,
          RecordedAt: recordTime.toISOString(),
          VrState: session.VrState,
          Difficulty: session.Difficulty,
          HeartRate: Math.round(session.AvgHeartRate + (Math.random() - 0.5) * 10),
          StressScore: Math.round(session.PeakStressScore + (Math.random() - 0.5) * 5),
          SpO2: Math.round(95 + (Math.random() - 0.5) * 4),
          TherapistAction: 'None'
        });
      }
    });

    return profiles;
  }

  /**
   * Save mock data to database (would need actual DB connection)
   * @param {Array} sessions - Session data to save
   * @returns {Promise<void>}
   */
  async seedDatabase(sessions) {
    try {
      console.log(`[SEEDER] Seeding database with ${sessions.length} scene records`);
      
      // This would need actual database connection implementation
      // For now, just generate the SQL
      const sql = this.generateSQLInserts(sessions);
      
      console.log('[SEEDER] Generated SQL for database seeding:');
      console.log(sql);
      
      return sessions;
    } catch (error) {
      console.error('[SEEDER] Error seeding database:', error);
      throw error;
    }
  }

  /**
   * Run the complete seeder process
   * @param {number} sessionCount - Number of sessions to generate
   * @returns {Promise<Array>} Generated data
   */
  async run(sessionCount = 8) {
    console.log(`[SEEDER] Starting clinical data seeder with ${sessionCount} sessions`);
    
    const sessions = this.generateMockSessions(sessionCount);
    await this.seedDatabase(sessions);
    
    console.log(`[SEEDER] Successfully generated ${sessions.length} scene records across ${sessionCount} sessions`);
    
    return sessions;
  }
}

module.exports = ClinicalDataSeeder;
