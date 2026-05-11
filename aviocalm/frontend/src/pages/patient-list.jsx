import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import './patient-list.css';

export const PatientList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch patients from API
  useEffect(() => {
    const fetchPatients = async () => {
      setIsLoading(true);
      try {
        const result = await apiRequest('/patients', {
          method: 'GET',
        });
        if (result.success) {
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

    fetchPatients();
  }, [user]);

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

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleViewDetails = (patientId) => {
    navigate(`/patients/${patientId}`);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-green-600 bg-green-100';
      case 'Pending': return 'text-yellow-600 bg-yellow-100';
      case 'Closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
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
            {filteredPatients.map((patient) => (
              <tr key={patient.id} className="patient-list__row">
                <td className="patient-list__id">{patient.national_id || 'N/A'}</td>
                <td className="patient-list__name">{patient.full_name || 'N/A'}</td>
                <td>
                  <span className={`patient-list__status ${getStatusColor(patient.status)}`}>
                    {patient.status || 'N/A'}
                  </span>
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
