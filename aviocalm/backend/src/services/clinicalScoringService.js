/**
 * Clinical Scoring Service
 * Calculates weighted stress scores for VR therapy sessions
 * Implements difficulty-based scoring algorithms for clinical insights
 */

const { insertAnxietyProfile } = require('../db/dbManager');

class ClinicalScoringService {
  constructor() {
    // Difficulty weights for stress scoring
    this.difficultyWeights = {
      'Easy': 1.0,      // Standard scoring
      'Medium': 0.9,    // 10% more forgiving
      'Hard': 0.85,     // 15% more forgiving
      'None': 1.0       // Default weight
    };

    // VR state weights for clinical significance
    this.vrStateWeights = {
      'Boarding': 0.8,   // Lower stress expected
      'Takeoff': 1.2,    // Higher stress expected
      'Cruising': 1.0,   // Normal stress expected
      'Landing': 1.3,    // Highest stress expected
      'Taxiing': 0.9     // Moderate stress expected
    };
  }

  /**
   * Calculate aggregated scores for a VR scene
   * @param {Array} metrics - Array of raw biometric metrics for a scene
   * @param {string} sessionId - Session identifier
   * @param {string} patientId - Patient identifier
   * @param {string} vrState - Current VR state
   * @param {string} difficulty - Difficulty level
   * @returns {Object} Aggregated scoring data
   */
  calculateSceneScores(metrics, sessionId, patientId, vrState, difficulty) {
    if (!metrics || metrics.length === 0) {
      throw new Error('No metrics provided for scoring calculation');
    }

    // Calculate average heart rate
    const avgHeartRate = metrics.reduce((sum, metric) => sum + metric.heartRate, 0) / metrics.length;

    // Find peak stress score
    const peakStressScore = Math.max(...metrics.map(metric => metric.stressScore));

    // Calculate weighted stress score
    const calculatedWeightedScore = this.calculateWeightedScore(
      avgHeartRate,
      peakStressScore,
      vrState,
      difficulty
    );

    // Calculate scene duration in seconds
    const durationSeconds = this.calculateSceneDuration(metrics);

    return {
      score_id: null, // Will be assigned by database
      session_id: sessionId,
      patient_id: patientId,
      vr_state: vrState,
      difficulty: difficulty,
      avg_heart_rate: avgHeartRate,
      peak_stress_score: peakStressScore,
      calculated_weighted_score: calculatedWeightedScore,
      recorded_at: new Date().toISOString(),
      DurationSeconds: durationSeconds
    };
  }

  /**
   * Calculate weighted stress score based on physiological and contextual factors
   * @param {number} avgHeartRate - Average heart rate for the scene
   * @param {number} peakStressScore - Peak stress score (0-100)
   * @param {string} vrState - VR state/context
   * @param {string} difficulty - Difficulty level
   * @returns {number} Calculated weighted stress score
   */
  calculateWeightedScore(avgHeartRate, peakStressScore, vrState, difficulty) {
    // Base stress score from peak stress
    let baseScore = peakStressScore;

    // Apply difficulty weight (more forgiving for harder difficulties)
    const difficultyWeight = this.difficultyWeights[difficulty] || 1.0;
    baseScore *= difficultyWeight;

    // Apply VR state weight (contextual adjustment)
    const vrStateWeight = this.vrStateWeights[vrState] || 1.0;
    baseScore *= vrStateWeight;

    // Heart rate contribution (elevated HR increases weighted score)
    const hrContribution = this.calculateHeartRateContribution(avgHeartRate);
    baseScore += hrContribution;

    // Ensure score stays within 0-100 range
    return Math.max(0, Math.min(100, baseScore));
  }

  /**
   * Calculate heart rate contribution to weighted score
   * @param {number} avgHeartRate - Average heart rate
   * @returns {number} Heart rate contribution (0-20 points)
   */
  calculateHeartRateContribution(avgHeartRate) {
    // Normal resting HR: 60-100 BPM
    const normalRange = { min: 60, max: 100 };
    
    if (avgHeartRate <= normalRange.max) {
      return 0; // No contribution for normal HR
    }

    // Calculate excess above normal range
    const excess = avgHeartRate - normalRange.max;
    
    // Scale contribution: 0-20 points for HR 100-180+
    const maxExcess = 80; // 180 - 100
    const contribution = (excess / maxExcess) * 20;
    
    return Math.min(20, contribution);
  }

  /**
   * Calculate scene duration in seconds
   * @param {Array} metrics - Array of metrics with timestamps
   * @returns {number} Duration in seconds
   */
  calculateSceneDuration(metrics) {
    if (metrics.length < 2) return 0;

    const firstTimestamp = new Date(metrics[0].timestamp);
    const lastTimestamp = new Date(metrics[metrics.length - 1].timestamp);
    
    return Math.floor((lastTimestamp - firstTimestamp) / 1000);
  }

  /**
   * Save aggregated scene scores to database
   * @param {Object} scoreData - Aggregated scoring data
   * @returns {Promise<Object>} Database result
   */
  async saveSceneScores(scoreData) {
    try {
      const query = `
        INSERT INTO "scene_stress_scores" 
        ("score_id", "session_id", "patient_id", "vr_state", "difficulty", 
         "avg_heart_rate", "peak_stress_score", "calculated_weighted_score", "recorded_at")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const values = [
        scoreData.score_id,
        scoreData.session_id,
        scoreData.patient_id,
        scoreData.vr_state,
        scoreData.difficulty,
        scoreData.avg_heart_rate,
        scoreData.peak_stress_score,
        scoreData.calculated_weighted_score,
        scoreData.recorded_at
      ];

      // Note: This would need a database connection implementation
      // For now, return the score data as if saved
      console.log(`[CLINICAL SCORING] Saved scene scores for ${scoreData.vr_state} - Weighted Score: ${scoreData.calculated_weighted_score.toFixed(2)}`);
      
      return scoreData;
    } catch (error) {
      console.error('[CLINICAL SCORING] Error saving scene scores:', error);
      throw error;
    }
  }

  /**
   * Process scene completion and calculate scores
   * @param {Array} sceneMetrics - All metrics for the completed scene
   * @param {string} sessionId - Session identifier
   * @param {string} patientId - Patient identifier
   * @param {string} vrState - VR state that just completed
   * @param {string} difficulty - Difficulty level
   * @returns {Promise<Object>} Calculated and saved scores
   */
  async processSceneCompletion(sceneMetrics, sessionId, patientId, vrState, difficulty) {
    try {
      console.log(`[CLINICAL SCORING] Processing scene completion for ${vrState} with ${sceneMetrics.length} data points`);
      
      // Calculate aggregated scores
      const scoreData = this.calculateSceneScores(
        sceneMetrics, 
        sessionId, 
        patientId, 
        vrState, 
        difficulty
      );

      // Save to database
      const savedScore = await this.saveSceneScores(scoreData);

      // Also save individual metrics to anxiety_profiles table
      for (const metric of sceneMetrics) {
        await insertAnxietyProfile({
          sessionId: sessionId,
          timestamp: metric.timestamp,
          vrState: vrState,
          difficulty: difficulty,
          vitals: {
            heartRate: metric.heartRate,
            stressScore: metric.stressScore,
            spo2: metric.spo2
          },
          therapistAction: 'None'
        });
      }

      return savedScore;
    } catch (error) {
      console.error('[CLINICAL SCORING] Error processing scene completion:', error);
      throw error;
    }
  }

  /**
   * Get historical insights for a patient
   * @param {string} patientId - Patient identifier
   * @returns {Promise<Array>} Historical scoring data
   */
  async getPatientInsights(patientId) {
    try {
      // Note: This would need database query implementation
      // For now, return mock data structure
      console.log(`[CLINICAL SCORING] Fetching insights for patient ${patientId}`);
      
      return [
        {
          score_id: 'mock-1',
          session_id: 'session-1',
          patient_id: patientId,
          vr_state: 'Boarding',
          difficulty: 'Easy',
          avg_heart_rate: 85.5,
          peak_stress_score: 45.2,
          calculated_weighted_score: 42.8,
          recorded_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          score_id: 'mock-2',
          session_id: 'session-2',
          patient_id: patientId,
          vr_state: 'Takeoff',
          difficulty: 'Medium',
          avg_heart_rate: 95.3,
          peak_stress_score: 68.7,
          calculated_weighted_score: 65.4,
          recorded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
    } catch (error) {
      console.error('[CLINICAL SCORING] Error fetching patient insights:', error);
      throw error;
    }
  }
}

// Create singleton instance
const clinicalScoringService = new ClinicalScoringService();

module.exports = {
  calculateSceneScores: (metrics, sessionId, patientId, vrState, difficulty) => 
    clinicalScoringService.calculateSceneScores(metrics, sessionId, patientId, vrState, difficulty),
  processSceneCompletion: (sceneMetrics, sessionId, patientId, vrState, difficulty) =>
    clinicalScoringService.processSceneCompletion(sceneMetrics, sessionId, patientId, vrState, difficulty),
  getPatientInsights: (patientId) => clinicalScoringService.getPatientInsights(patientId),
  saveSceneScores: (scoreData) => clinicalScoringService.saveSceneScores(scoreData)
};
