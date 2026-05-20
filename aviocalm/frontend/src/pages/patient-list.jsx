import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/auth-context';
import { useNavigate } from 'react-router-dom';
import { apiRequest, api } from '../utils/api';
import './patient-list.css';

const VALID_STATUSES = ['Active', 'Inactive', 'Discharged'];

// Tailwind classes for each status pill badge
const STATUS_BADGE = {
  Active:     'bg-emerald-100 text-emerald-800',
  Inactive:   'bg-gray-100 text-gray-800',
  Discharged: 'bg-blue-100 text-blue-800',
};

// Colored dot indicator for each status option in the dropdown
const STATUS_DOT = {
  Active:     'bg-emerald-500',
  Inactive:   'bg-gray-400',
  Discharged: 'bg-blue-500',
};

export const PatientList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Tracks which patient row's status dropdown is currently open
  const [editingStatusId, setEditingStatusId] = useState(null);
  // Fixed viewport coordinates for the portal dropdown, derived from getBoundingClientRect
  const [dropdownPosition, setDropdownPosition] = useState(null);
  // Tracks which patient row is awaiting a status API response
  const [statusUpdating, setStatusUpdating] = useState(null);
  const dropdownRef = useRef(null);

  // Fetch patients — defined at component scope so multiple effects can call it
  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const result = await apiRequest('/patients', {
        method: 'GET',
      });
      if (result.success) {
        console.log('[PatientList] patients received from API:', result.data);
        console.log('[PatientList] has_unread_sessions values:', (result.data || []).map(p => ({ id: p.id, name: p.full_name, has_unread_sessions: p.has_unread_sessions })));
        setPatients(result.data || []);
      } else {
        setError(result.error || 'Failed to fetch patients');
        setPatients([]);
      }
    } catch (error) {
      setError('Network error. Please try again.');
      setPatients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch when the authenticated user context is ready
  useEffect(() => {
    fetchPatients();
  }, [user]);

  // Re-fetch whenever the browser tab/window regains visibility so the list
  // stays current after a simulation completes in another tab or window
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPatients();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Filter patients based on search query
  useEffect(() => {
    if (!Array.isArray(patients)) {
      setFilteredPatients([]);
      return;
    }
    
    const filtered = patients.filter(patient => {
      if (!patient) return false;
      
      const fullName = (patient.full_name || '').toLowerCase();
      const nationalId = (patient.national_id || '').toLowerCase();
      const searchLower = (searchQuery || '').toLowerCase();
      
      return fullName.includes(searchLower) || nationalId.includes(searchLower);
    });
    setFilteredPatients(filtered);
  }, [patients, searchQuery]);

  // Close the dropdown on outside click.
  // Registration is delayed by one tick so the opening click itself does not trigger close.
  useEffect(() => {
    if (!editingStatusId) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setEditingStatusId(null);
        setDropdownPosition(null);
      }
    };
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingStatusId]);

  // Close the dropdown when the page scrolls so it does not drift from its anchor badge
  useEffect(() => {
    if (!editingStatusId) return;
    const handleScroll = () => {
      setEditingStatusId(null);
      setDropdownPosition(null);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [editingStatusId]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleViewDetails = (patientId) => {
    navigate(`/patients/${patientId}`);
  };

  // Open or close the status dropdown for a given patient row.
  // When opening, capture the badge's viewport coordinates for the portal dropdown.
  // Bottom rows (last 2) open UPWARD to avoid viewport clipping.
  const handleStatusBadgeClick = (e, patientId, rowIndex) => {
    e.stopPropagation();
    if (editingStatusId === patientId) {
      setEditingStatusId(null);
      setDropdownPosition(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    // If this is one of the last 2 rows, anchor from the bottom of the viewport upward
    const isBottomRow = rowIndex >= filteredPatients.length - 2;
    setDropdownPosition(
      isBottomRow
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left, openUp: true }
        : { top: rect.bottom + 4,                      left: rect.left, openUp: false }
    );
    setEditingStatusId(patientId);
  };

  // Call the API and optimistically update local state on success
  const handleStatusSelect = async (patientId, newStatus) => {
    setEditingStatusId(null);
    setDropdownPosition(null);
    setStatusUpdating(patientId);
    try {
      const result = await api.updatePatientStatus(patientId, newStatus);
      if (result.success) {
        setPatients(prev =>
          prev.map(p => p.id === patientId ? { ...p, status: newStatus } : p)
        );
      }
    } catch (err) {
      console.error('Failed to update patient status:', err);
    } finally {
      setStatusUpdating(null);
    }
  };

  return (
    <div className="patient-list">
      {/* Loading State */}
      {isLoading && (
        <div className="patient-list__loading">
          <div className="login-form__spinner">
            <svg className="login-form__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="login-form__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="login-form__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading patients...
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="patient-list__error">
          <div className="patient-list__error-content">
            <h3 className="patient-list__error-title">{error}</h3>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {!isLoading && !error && (
        <div className="patient-list__search-section">
          <div className="patient-list__search-container">
            <div className="patient-list__search-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by Patient ID or Name..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="patient-list__search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="patient-list__clear-btn"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results Count */}
      {!isLoading && !error && (
        <div className="patient-list__results-info">
          <span className="patient-list__results-count">
            {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'} found
          </span>
          {searchQuery && (
            <span className="patient-list__search-term">
              for "{searchQuery}"
            </span>
          )}
        </div>
      )}

      {/* Patient Table */}
      <div className="patient-list__table-container">
        <table className="patient-list__table">
          <thead>
            <tr>
              <th>National ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Created Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient, index) => (
              <tr key={patient.id} className="patient-list__row">
                <td className="patient-list__id">{patient.national_id || 'N/A'}</td>
                <td className="patient-list__name">
                  {patient.full_name || 'N/A'}
                  {/* Blue dot signals at least one completed-but-unreviewed session */}
                  {patient.has_unread_sessions && (
                    <span
                      className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block ml-2 align-middle"
                      title="Unread session"
                    />
                  )}
                </td>
                <td>
                  {/* Badge only — no wrapper div needed; the dropdown lives in a portal */}
                  <button
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium border-none cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${STATUS_BADGE[patient.status] || STATUS_BADGE.Inactive}`}
                    onClick={(e) => handleStatusBadgeClick(e, patient.id, index)}
                    disabled={statusUpdating === patient.id}
                    title="Click to change status"
                  >
                    {statusUpdating === patient.id ? (
                      // Spinner while the API call is in flight
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {patient.status || 'N/A'}
                        <svg className="w-3 h-3 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </>
                    )}
                  </button>
                </td>
                <td className="patient-list__date">{patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <button 
                    onClick={() => handleViewDetails(patient.id)}
                    className="patient-list__action-btn"
                  >
                    View Record
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status dropdown portal — rendered into document.body to escape the table's overflow constraints.
           Uses fixed positioning anchored to the badge's getBoundingClientRect coordinates. */}
      {editingStatusId && dropdownPosition && (() => {
        const activePatient = filteredPatients.find(p => p.id === editingStatusId);
        if (!activePatient) return null;
        return createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              left: dropdownPosition.left,
              zIndex: 9999,
              // Upward: anchor bottom edge to just above the badge; downward: anchor top edge just below it
              ...(dropdownPosition.openUp
                ? { bottom: dropdownPosition.bottom }
                : { top:    dropdownPosition.top    }
              ),
            }}
            className="bg-white shadow-lg rounded-md border border-gray-200 min-w-[160px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {VALID_STATUSES.map((s) => (
              <button
                key={s}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left border-none cursor-pointer transition-colors ${
                  s === activePatient.status
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'bg-white text-gray-700 hover:bg-gray-50 font-normal'
                }`}
                onClick={() => handleStatusSelect(activePatient.id, s)}
              >
                {/* Colored dot indicator */}
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[s]}`} />
                {s}
                {/* Check icon marks the currently active status */}
                {s === activePatient.status && (
                  <svg className="w-3.5 h-3.5 ml-auto text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.17l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        );
      })()}

      {/* Empty State */}
      {filteredPatients.length === 0 && (
        <div className="patient-list__empty">
          <div className="patient-list__empty-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 5.656l6.344 6.344a4 4 0 005.656 5.656l6.344-6.344a4 4 0 00-5.656-5.656L9.172 10a4 4 0 01-5.656-5.656L-2.828 4.75a4 4 0 00-5.656 5.656l6.344 6.344a4 4 0 005.656-5.656L21 12a4 4 0 01.656 5.656l-6.344 6.344a4 4 0 00-5.656-5.656z" />
            </svg>
          </div>
          <h3 className="patient-list__empty-title">No Patients Found</h3>
          <p className="patient-list__empty-message">
            {searchQuery 
              ? `No patients found matching "${searchQuery}"`
              : 'No patients available'
            }
          </p>
        </div>
      )}
    </div>
  );
};
