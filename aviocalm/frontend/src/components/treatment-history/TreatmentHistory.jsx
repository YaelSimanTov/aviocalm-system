import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, api } from '../../utils/api';
import './TreatmentHistory.css';

// Treatment History Component — renders the sessions table only.
// Clicking "View Record" navigates to the dedicated session dashboard page.
export const TreatmentHistory = ({ patientId }) => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  // Fetch patient sessions on component mount
  useEffect(() => {
    if (patientId) {
      fetchSessions();
    }
  }, [patientId]);

  // Mark all completed sessions as reviewed ONLY when the component truly unmounts.
  // The 500ms mount-time guard prevents React Strict Mode's fake unmount (fires within ~1ms)
  // from calling the API during development double-invoke, while still firing on real navigation.
  useEffect(() => {
    if (!patientId) return;
    const mountTime = Date.now();
    return () => {
      if (Date.now() - mountTime < 500) return;
      api.markSessionsRead(patientId);
    };
  }, [patientId]);

  // Fetch sessions from the API
  const fetchSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiRequest(`/patients/${patientId}/sessions`);
      if (result.success) {
        setSessions(result.data);
      } else {
        setError(result.error || 'Failed to fetch sessions');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display in Israel local time (IDT/IST, GMT+3).
  // PostgreSQL TIMESTAMP WITHOUT TIME ZONE returns strings without a 'Z' suffix
  // (e.g. "2026-05-20T15:30:00.123"), causing browsers to treat them as local time
  // instead of UTC. Appending 'Z' forces correct UTC parsing before conversion.
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const asUtc = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    return new Date(asUtc).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  };

  // Format duration for display
  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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

  // Render loading state
  if (loading) {
    return (
      <div className="treatment-history">
        <div className="treatment-history__loading">
          <div className="treatment-history__spinner">
            <svg className="treatment-history__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="treatment-history__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="treatment-history__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                {sessions.map((session) => {
                  console.log('[TreatmentHistory Row]', { id: session.id, status: session.status, is_reviewed: session.is_reviewed, type_of_reviewed: typeof session.is_reviewed });
                  return (
                  <tr key={session.id} className="treatment-history__table-row">
                    <td className="treatment-history__table-cell">
                      <span className="inline-flex items-center gap-2">
                        {formatDate(session.started_at)}
                        {/* Blue dot for completed sessions the therapist hasn't seen yet.
                            Explicit false/null check covers every falsy DB return value. */}
                        {!session.is_reviewed && session.status === 'Completed' && (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 mr-2"
                            title="Unread Session"
                          ></span>
                        )}
                      </span>
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
                        onClick={() => navigate(`/patients/${patientId}/sessions/${session.id}`, { state: { session } })}
                        className="treatment-history__view-btn"
                        disabled={session.status !== 'Completed'}
                      >
                        View Record
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default TreatmentHistory;
