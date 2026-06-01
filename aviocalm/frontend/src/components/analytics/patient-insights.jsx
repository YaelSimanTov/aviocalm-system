/**
 * Patient Insights Component
 * Displays historical clinical data and trends for patient therapy progress
 * Implements Epic 3.2: Data Aggregation & Clinical Scoring
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components individually
Chart.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PatientInsights = ({ patientId }) => {
  const [insights, setInsights] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Mock patient ID if not provided
  const currentPatientId = patientId || '550e8400-e29b-41d4-a716-446655440000';

  useEffect(() => {
    fetchPatientInsights();
    fetchPatientSummary();
  }, [currentPatientId]);

  useEffect(() => {
    if (insights.length > 0 && !chartInstance.current) {
      initializeChart();
    }
  }, [insights]);

  /**
   * Fetch patient insights from backend API
   */
  const fetchPatientInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/insights/${currentPatientId}`);
      const data = await response.json();
      
      if (data.success) {
        setInsights(data.data.insights);
      } else {
        setError(data.error || 'Failed to fetch insights');
      }
    } catch (err) {
      setError('Network error while fetching insights');
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch patient summary statistics
   */
  const fetchPatientSummary = async () => {
    try {
      const response = await fetch(`/api/analytics/insights/${currentPatientId}/summary`);
      const data = await response.json();
      
      if (data.success) {
        setSummary(data.data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  /**
   * Initialize Chart.js historical trend chart
   */
  const initializeChart = () => {
    const ctx = chartRef.current.getContext('2d');
    
    // Destroy existing chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Prepare data for chart
    const sortedInsights = [...insights].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    
    const labels = sortedInsights.map(insight => {
      const date = new Date(insight.recorded_at);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const weightedScores = sortedInsights.map(insight => insight.calculated_weighted_score);
    const peakStressScores = sortedInsights.map(insight => insight.peak_stress_score);

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Weighted Stress Score',
            data: weightedScores,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Peak Stress Score',
            data: peakStressScores,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: {
                size: 12,
                family: 'system-ui'
              }
            }
          },
          title: {
            display: true,
            text: 'Historical Stress Trends',
            font: {
              size: 16,
              family: 'system-ui',
              weight: 'bold'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Stress Score (0-100)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Session Date'
            }
          }
        }
      }
    });
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  /**
   * Get difficulty color for styling
   */
  const getDifficultyColor = (difficulty) => {
    const colors = {
      'Easy': 'text-green-600 bg-green-100',
      'Medium': 'text-yellow-600 bg-yellow-100',
      'Hard': 'text-red-600 bg-red-100'
    };
    return colors[difficulty] || 'text-gray-600 bg-gray-100';
  };

  /**
   * Get VR state color for styling
   */
  const getVrStateColor = (vrState) => {
    const colors = {
      'Boarding': 'text-blue-600 bg-blue-100',
      'Takeoff': 'text-orange-600 bg-orange-100',
      'Cruising': 'text-green-600 bg-green-100',
      'Landing': 'text-red-600 bg-red-100',
      'Taxiing': 'text-purple-600 bg-purple-100'
    };
    return colors[vrState] || 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading patient insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Insights</h2>
        <p className="text-gray-600">Historical clinical data and therapy progress trends</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm font-medium text-gray-600">Avg Weighted Score</div>
            <div className="text-2xl font-bold text-gray-900">{summary.avgWeightedScore}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm font-medium text-gray-600">Avg Heart Rate</div>
            <div className="text-2xl font-bold text-gray-900">{summary.avgHeartRate} BPM</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm font-medium text-gray-600">Most Challenging</div>
            <div className="text-lg font-bold text-gray-900">{summary.mostChallengingVrState}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="text-sm font-medium text-gray-600">Progress Trend</div>
            <div className={`text-lg font-bold ${
              summary.improvementTrend === 'improving' ? 'text-green-600' :
              summary.improvementTrend === 'declining' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {summary.improvementTrend}
            </div>
          </div>
        </div>
      )}

      {/* Historical Trend Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Stress Trends</h3>
        <div className="h-96">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VR State
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg HR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peak Stress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weighted Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {insights
                .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
                .map((insight, index) => (
                  <tr key={insight.score_id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(insight.recorded_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getVrStateColor(insight.vr_state)}`}>
                        {insight.vr_state}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDifficultyColor(insight.difficulty)}`}>
                        {insight.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {insight.avg_heart_rate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {insight.peak_stress_score}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {insight.calculated_weighted_score}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PatientInsights;
