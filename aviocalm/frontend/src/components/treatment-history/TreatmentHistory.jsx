import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import './TreatmentHistory.css';

// Color constants for charts
const COLORS = {
  RELAXED: '#10b981',      // green
  MODERATE: '#f59e0b',    // amber  
  PANIC: '#ef4444',        // red
  HEART_RATE: '#3b82f6',   // blue
  STRESS: '#8b5cf6',       // purple
  BASELINE: '#6b7280'      // gray
};

// VR State colors for background areas (matching exact game design flow)
const VR_STATE_COLORS = {
  'BoardingState': '#dbeafe',      // light blue - Lobby
  'TakeOffState': '#fed7aa',       // light orange/red - Takeoff
  'InFlightState': '#a7f3d0',      // emerald green - Cruising
  'LandingState': '#e9d5ff',       // light purple - Landing
  'LandedState': '#cbd5e1',        // slate gray - Completed
  'PausedState': '#e5e7eb',        // gray - Paused
  'Default': '#f3f4f6'             // light gray
};

// Stage name translations for display
const STAGE_NAMES = {
  'BoardingState': 'Lobby',
  'TakeOffState': 'Takeoff',
  'InFlightState': 'Cruising',
  'LandingState': 'Landing',
  'LandedState': 'Completed',
  'PausedState': 'Paused'
};

// Treatment History Component
export const TreatmentHistory = ({ patientId }) => {
  // State management for sessions and analytics
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
  
  // State for treatment decisions (Epic 4.3 - Asynchronous Recommendation & Audit)
  const [treatmentDecisions, setTreatmentDecisions] = useState([]);
  const [treatmentDecisionsLoading, setTreatmentDecisionsLoading] = useState(false);
  const [treatmentDecisionsError, setTreatmentDecisionsError] = useState('');

  // Fetch patient sessions on component mount
  useEffect(() => {
    if (patientId) {
      fetchSessions();
    }
  }, [patientId]);

  // Fetch sessions from API
  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError('');
      
      const result = await apiRequest(`/patients/${patientId}/sessions`);
      
      if (result.success) {
        setSessions(result.data);
      } else {
        setError(result.error || 'Failed to fetch sessions');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch session analytics when a session is selected
  const fetchSessionAnalytics = async (sessionId) => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      
      const result = await apiRequest(`/patients/sessions/${sessionId}/analytics`);
      
      if (result.success) {
        setAnalyticsData(result.data);
      } else {
        setAnalyticsError(result.error || 'Failed to fetch analytics');
      }
    } catch (error) {
      setAnalyticsError('Network error. Please try again.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch treatment decisions for a session (Epic 4.3 - Asynchronous Recommendation & Audit)
  const fetchTreatmentDecisions = async (sessionId) => {
    try {
      setTreatmentDecisionsLoading(true);
      setTreatmentDecisionsError('');
      
      const result = await apiRequest(`/analytics/treatment-decisions/${sessionId}`);
      
      if (result.success) {
        setTreatmentDecisions(result.data.treatmentDecisions);
      } else {
        setTreatmentDecisionsError(result.error || 'Failed to fetch treatment decisions');
      }
    } catch (error) {
      setTreatmentDecisionsError('Network error. Please try again.');
    } finally {
      setTreatmentDecisionsLoading(false);
    }
  };

  // Handle session drill-down
  const handleViewRecord = (session) => {
    console.log("Session selected:", session.id);
    console.log("Full session object:", session);
    
    // Set selected session to the full session object, not just the ID
    setSelectedSession(session);
    
    // Fetch analytics data
    fetchSessionAnalytics(session.id);
    
    // Fetch treatment decisions for executive summary alert (Epic 4.3)
    fetchTreatmentDecisions(session.id);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Format duration for display
  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Helper function to generate VR state blocks for ReferenceArea
  const generateVrStateBlocks = (timeSeriesData) => {
    if (!timeSeriesData || timeSeriesData.length === 0) return [];
    
    const blocks = [];
    let currentVrState = timeSeriesData[0].vrState;
    let startIndex = 0;
    
    for (let i = 1; i < timeSeriesData.length; i++) {
      const entry = timeSeriesData[i];
      
      // If VR state changes, create a block for the previous state
      if (entry.vrState !== currentVrState) {
        blocks.push({
          startIndex: startIndex,
          endIndex: i - 1,
          vrState: currentVrState,
          color: VR_STATE_COLORS[currentVrState] || VR_STATE_COLORS.Default
        });
        
        // Start new block
        currentVrState = entry.vrState;
        startIndex = i;
      }
    }
    
    // Add the final block
    if (startIndex < timeSeriesData.length) {
      blocks.push({
        startIndex: startIndex,
        endIndex: timeSeriesData.length - 1,
        vrState: currentVrState,
        color: VR_STATE_COLORS[currentVrState] || VR_STATE_COLORS.Default
      });
    }
    
    console.log("Calculated Reference Areas:", blocks);
    return blocks;
  };

  // Get status color class
  const getStatusClass = (status) => {
    switch (status) {
      case 'Completed':
        return 'status-completed';
      case 'In Progress':
        return 'status-in-progress';
      case 'Halted':
        return 'status-halted';
      default:
        return 'status-unknown';
    }
  };

  // Calculate baseline HR from analytics data
  const getBaselineHR = () => {
    if (!analyticsData?.timeSeriesData || analyticsData.timeSeriesData.length === 0) {
      return 70; // Default baseline
    }
    
    const avgHR = analyticsData.timeSeriesData.reduce((sum, point) => sum + point.avgHeartRate, 0) / analyticsData.timeSeriesData.length;
    return Math.round(avgHR);
  };

  // Calculate the number of times patient ignored system recommendations (Epic 4.3)
  const calculateRecommendationViolations = () => {
    if (!treatmentDecisions || treatmentDecisions.length === 0) {
      return 0;
    }
    
    // Count instances where patient selected higher difficulty than recommended
    const violationCount = treatmentDecisions.filter(
      decision => decision.actual_difficulty_selected_by_patient > decision.suggested_difficulty
    ).length;
    
    return violationCount;
  };

  // Render loading state
  if (loading) {
    return (
      <div className="treatment-history">
        <div className="treatment-history__loading">
          <div className="treatment-history__spinner">
            <svg className="treatment-history__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="treatment-history__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="treatment-history__spinner-path" fill="currentColor" d="M4 12a8 8 0 0 18-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 18 5.291 0 12h4z"></path>
            </svg>
            Loading treatment sessions...
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="treatment-history">
        <div className="treatment-history__error">
          <h3 className="treatment-history__error-title">{error}</h3>
          <button onClick={fetchSessions} className="treatment-history__retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="treatment-history">
      {/* Sessions Table */}
      <div className="treatment-history__sessions-section">
        <h3 className="treatment-history__section-title">Treatment Sessions</h3>
        
        {sessions.length === 0 ? (
          <div className="treatment-history__empty-state">
            <h4 className="treatment-history__empty-title">No treatment sessions yet</h4>
            <p className="treatment-history__empty-message">
              Once VR therapy sessions begin, they will appear here.
            </p>
          </div>
        ) : (
          <div className="treatment-history__table-container">
            <table className="treatment-history__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>HRV RMSSD</th>
                  <th>Difficulty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="treatment-history__table-row">
                    <td className="treatment-history__table-cell">
                      {formatDate(session.started_at)}
                    </td>
                    <td className="treatment-history__table-cell">
                      {formatDuration(session.duration_minutes)}
                    </td>
                    <td className="treatment-history__table-cell">
                      {session.overall_hrv_rmssd ? `${session.overall_hrv_rmssd}ms` : 'N/A'}
                    </td>
                    <td className="treatment-history__table-cell">
                      {Array.isArray(session.difficulties) && session.difficulties.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {session.difficulties.map((difficulty, index) => (
                            <span
                              key={index}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                                difficulty === 'Medium' ? 'bg-orange-100 text-orange-800' :
                                difficulty === 'Hard' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {difficulty}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="treatment-history__table-cell">
                      <span className={`treatment-history__status ${getStatusClass(session.status)}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="treatment-history__table-cell">
                      <button
                        onClick={() => handleViewRecord(session)}
                        className="treatment-history__view-btn"
                        disabled={session.status !== 'Completed'}
                      >
                        View Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analytics Section */}
      {selectedSession && (() => {
        // Create chart data with numerical indices for reliable ReferenceArea positioning
        const chartData = analyticsData?.timeSeriesData?.map((d, i) => ({ ...d, dataIndex: i })) || [];
        
        return (
        <div className="treatment-history__analytics-section">
          <div className="treatment-history__analytics-header">
            <h3 className="treatment-history__section-title">Session Analytics</h3>
            <button
              onClick={() => setSelectedSession(null)}
              className="treatment-history__close-btn"
            >
              ×
            </button>
          </div>

          {analyticsLoading ? (
            <div className="treatment-history__analytics-loading">
              <div className="treatment-history__spinner">
                <svg className="treatment-history__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="treatment-history__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="treatment-history__spinner-path" fill="currentColor" d="M4 12a8 8 0 0 18-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 18 5.291 0 12h4z"></path>
                </svg>
                Loading analytics...
              </div>
            </div>
          ) : analyticsError ? (
            <div className="treatment-history__analytics-error">
              <h4 className="treatment-history__error-title">{analyticsError}</h4>
              <button
                onClick={() => fetchSessionAnalytics(selectedSession.id)}
                className="treatment-history__retry-btn"
              >
                Retry
              </button>
            </div>
          ) : analyticsData ? (
            <div className="treatment-history__analytics-content">
              {/* Time Series Chart */}
              <div className="treatment-history__chart-container">
                {(() => {
                  const chartData = analyticsData.timeSeriesData.map((d, i) => ({
                    ...d,
                    dataIndex: i
                  }));
                  
                  const blocks = generateVrStateBlocks(chartData);
                  
                  return (
                    <>
                      {/* Render VR Stage Legend */}
                      <div className="flex flex-wrap justify-center gap-6 mb-4 text-sm font-medium text-gray-600">
                        {Object.entries(STAGE_NAMES).map(([state, name]) => {
                          if (state === 'PausedState' || !VR_STATE_COLORS[state]) return null;
                          return (
                            <div key={state} className="flex items-center gap-2">
                              <div 
                                style={{ 
                                  width: '16px', 
                                  height: '16px', 
                                  backgroundColor: VR_STATE_COLORS[state], 
                                  opacity: 0.7, 
                                  borderRadius: '4px' 
                                }}
                              />
                              <span>{name}</span>
                            </div>
                          );
                        })}
                      </div>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 40 }}>
                          {blocks.map((block, i) => (
                            <ReferenceArea
                              key={`bg-${i}`}
                              x1={block.startIndex}
                              x2={block.endIndex}
                              yAxisId="left"
                              fill={block.color}
                              fillOpacity={0.7}
                              strokeOpacity={0}
                            />
                          ))}
                          <CartesianGrid strokeDasharray="3 3" />
                          <ReferenceLine 
                            y={analyticsData?.baselineHr || 90} 
                            yAxisId="left" 
                            stroke="#4b5563" 
                            strokeWidth={2}
                            strokeDasharray="4 4" 
                            label={{ position: 'insideTopLeft', value: 'Baseline', fill: '#374151', fontSize: 14, fontWeight: 'bold' }} 
                          />
                          <XAxis 
                            dataKey="dataIndex" 
                            tickFormatter={(val) => chartData[val]?.timestamp ? new Date(chartData[val].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            minTickGap={15} 
                            angle={-35} 
                            textAnchor="end" 
                            height={60} 
                            tick={{ fontSize: 12 }} 
                          />
                          <YAxis yAxisId="left" domain={['dataMin - 10', 'dataMax + 10']} label={{ value: 'Heart Rate (BPM)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#3b82f6', fontWeight: 'bold' } }} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: 'Stress Score', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#8b5cf6', fontWeight: 'bold' } }} />
                          <Tooltip 
                            labelFormatter={(val) => chartData[val]?.timestamp ? new Date(chartData[val].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : val}
                            content={({ payload, label }) => {
                              if (payload && payload.length > 0) {
                                const data = payload[0].payload;
                                const time = new Date(data.timestamp);
                                const stageName = STAGE_NAMES[data.vrState] || data.vrState;
                                return (
                                  <div className="custom-tooltip">
                                    <p className="tooltip-time">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                                    <p className="tooltip-metric">Heart Rate: {data.avgHeartRate} BPM</p>
                                    <p className="tooltip-metric">Stress Score: {data.avgStressScore}</p>
                                    <p className="tooltip-state">Stage: {stageName} ({data.difficulty})</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line yAxisId="left" type="monotone" dataKey="avgHeartRate" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line yAxisId="right" type="monotone" dataKey="avgStressScore" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </>
                  );
                })()}
                <div className="treatment-history__chart-info">
                  <p>Showing {analyticsData.timeSeriesData.length} data points</p>
                  <p>Baseline HR: {getBaselineHR()} BPM</p>
                </div>
              </div>

              {/* Time in Range Distribution */}
              <div className="treatment-history__chart-container">
                <h4 className="treatment-history__chart-title">Time in Range Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Relaxed', value: analyticsData.timeInRangeDistribution.relaxed, color: COLORS.RELAXED },
                        { name: 'Moderate', value: analyticsData.timeInRangeDistribution.moderate, color: COLORS.MODERATE },
                        { name: 'Panic', value: analyticsData.timeInRangeDistribution.panic, color: COLORS.PANIC }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        { name: 'Relaxed', value: analyticsData.timeInRangeDistribution.relaxed, color: COLORS.RELAXED },
                        { name: 'Moderate', value: analyticsData.timeInRangeDistribution.moderate, color: COLORS.MODERATE },
                        { name: 'Panic', value: analyticsData.timeInRangeDistribution.panic, color: COLORS.PANIC }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${name}: ${value}%`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="treatment-history__pie-legend">
                  <div className="treatment-history__legend-item">
                    <div className="treatment-history__legend-color" style={{ backgroundColor: COLORS.RELAXED }}></div>
                    <span>Relaxed: {analyticsData.timeInRangeDistribution.relaxed}%</span>
                  </div>
                  <div className="treatment-history__legend-item">
                    <div className="treatment-history__legend-color" style={{ backgroundColor: COLORS.MODERATE }}></div>
                    <span>Moderate: {analyticsData.timeInRangeDistribution.moderate}%</span>
                  </div>
                  <div className="treatment-history__legend-item">
                    <div className="treatment-history__legend-color" style={{ backgroundColor: COLORS.PANIC }}></div>
                    <span>Panic: {analyticsData.timeInRangeDistribution.panic}%</span>
                  </div>
                </div>
              </div>

              {/* Session Summary */}
              <div className="treatment-history__session-summary">
                <h4 className="treatment-history__summary-title">Session Summary</h4>
                
                {/* Executive Summary Alert - Epic 4.3: Asynchronous Recommendation & Audit */}
                {(() => {
                  const violationCount = calculateRecommendationViolations();
                  if (violationCount > 0) {
                    return (
                      <div className="treatment-history__executive-alert">
                        <span className="treatment-history__alert-icon">⚠️</span>
                        <span className="treatment-history__alert-text">
                          Patient ignored system recommendations {violationCount} time{violationCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="treatment-history__summary-grid">
                  <div className="treatment-history__summary-item">
                    <span className="treatment-history__summary-label">Total Data Points:</span>
                    <span className="treatment-history__summary-value">
                      {analyticsData.timeSeriesData.reduce((sum, point) => sum + (point.dataPoints || 0), 0)}
                    </span>
                  </div>
                  <div className="treatment-history__summary-item">
                    <span className="treatment-history__summary-label">Time Windows:</span>
                    <span className="treatment-history__summary-value">
                      {analyticsData.timeSeriesData.length}
                    </span>
                  </div>
                  <div className="treatment-history__summary-item">
                    <span className="treatment-history__summary-label">Average Stress:</span>
                    <span className="treatment-history__summary-value">
                      {analyticsData.timeSeriesData.reduce((sum, point) => sum + (point.avgStressScore || 0), 0) / analyticsData.timeSeriesData.length > 0
                        ? (analyticsData.timeSeriesData.reduce((sum, point) => sum + (point.avgStressScore || 0), 0) / analyticsData.timeSeriesData.length).toFixed(1)
                        : '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        );
      })()}
    </div>
  );
};

export default TreatmentHistory;
