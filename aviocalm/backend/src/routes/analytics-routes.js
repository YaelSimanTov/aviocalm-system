/**
 * Analytics Routes
 * Provides endpoints for clinical insights and patient analytics
 * Implements Epic 3.2: Data Aggregation & Clinical Scoring
 */

const express = require('express');
const router = express.Router();
const { getPatientInsights } = require('../services/clinical-scoring-service');

/**
 * GET /api/analytics/insights/:patientId
 * Fetch historical aggregated records for a specific patient
 * Returns SceneStressScores data ordered by date/session
 */
router.get('/insights/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    console.log(`[ANALYTICS] Fetching insights for patient: ${patientId}`);
    
    // Get patient insights from clinical scoring service
    const insights = await getPatientInsights(patientId);
    
    res.json({
      success: true,
      data: {
        patientId: patientId,
        insights: insights,
        totalRecords: insights.length
      },
      message: 'Patient insights retrieved successfully'
    });
    
  } catch (error) {
    console.error('[ANALYTICS] Error fetching patient insights:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve patient insights',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/analytics/insights/:patientId/summary
 * Get summary statistics for a patient's therapy progress
 */
router.get('/insights/:patientId/summary', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: 'Patient ID is required'
      });
    }

    const insights = await getPatientInsights(patientId);
    
    // Calculate summary statistics
    const summary = calculateSummaryStats(insights);
    
    res.json({
      success: true,
      data: {
        patientId: patientId,
        summary: summary,
        totalSessions: insights.length
      }
    });
    
  } catch (error) {
    console.error('[ANALYTICS] Error calculating summary:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to calculate patient summary'
    });
  }
});

/**
 * Calculate summary statistics from insights data
 * @param {Array} insights - Patient insights data
 * @returns {Object} Summary statistics
 */
function calculateSummaryStats(insights) {
  if (!insights || insights.length === 0) {
    return {
      avgWeightedScore: 0,
      avgHeartRate: 0,
      avgPeakStress: 0,
      mostChallengingVrState: 'N/A',
      improvementTrend: 'stable',
      totalSessions: 0
    };
  }

  // Calculate averages
  const avgWeightedScore = insights.reduce((sum, record) => sum + record.calculated_weighted_score, 0) / insights.length;
  const avgHeartRate = insights.reduce((sum, record) => sum + record.avg_heart_rate, 0) / insights.length;
  const avgPeakStress = insights.reduce((sum, record) => sum + record.peak_stress_score, 0) / insights.length;

  // Find most challenging VR state (highest average weighted score)
  const vrStateStats = {};
  insights.forEach(record => {
    if (!vrStateStats[record.vr_state]) {
      vrStateStats[record.vr_state] = [];
    }
    vrStateStats[record.vr_state].push(record.calculated_weighted_score);
  });

  let mostChallengingVrState = 'N/A';
  let highestAvgScore = 0;
  
  Object.keys(vrStateStats).forEach(vrState => {
    const avgScore = vrStateStats[vrState].reduce((sum, score) => sum + score, 0) / vrStateStats[vrState].length;
    if (avgScore > highestAvgScore) {
      highestAvgScore = avgScore;
      mostChallengingVrState = vrState;
    }
  });

  // Calculate improvement trend (compare first half vs second half)
  const midpoint = Math.floor(insights.length / 2);
  const firstHalf = insights.slice(0, midpoint);
  const secondHalf = insights.slice(midpoint);
  
  const firstHalfAvg = firstHalf.reduce((sum, record) => sum + record.calculated_weighted_score, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, record) => sum + record.calculated_weighted_score, 0) / secondHalf.length;
  
  let improvementTrend = 'stable';
  if (secondHalfAvg < firstHalfAvg - 5) {
    improvementTrend = 'improving';
  } else if (secondHalfAvg > firstHalfAvg + 5) {
    improvementTrend = 'declining';
  }

  return {
    avgWeightedScore: Math.round(avgWeightedScore * 10) / 10,
    avgHeartRate: Math.round(avgHeartRate * 10) / 10,
    avgPeakStress: Math.round(avgPeakStress * 10) / 10,
    mostChallengingVrState,
    improvementTrend,
    totalSessions: insights.length
  };
}

/**
 * GET /api/analytics/health
 * Health check endpoint for analytics service
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Analytics API',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
