import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../../utils/api';
import './patients-dashboard.css';

export const PatientsDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch patients on component mount
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const result = await apiRequest('/patients');
      
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

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value || '');
  };

  // Filter patients client-side with safety checks
  const filteredPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    
    if (!searchTerm) return patients;
    
    const normalizedSearch = (searchTerm || '').toLowerCase().trim();
    if (!normalizedSearch) return patients;
    
    return patients.filter(patient => {
      if (!patient) return false;
      
      const fullName = (patient.full_name || '').toLowerCase();
      const nationalId = (patient.national_id || '').toLowerCase();
      
      return fullName.includes(normalizedSearch) || nationalId.includes(normalizedSearch);
    });
  }, [patients, searchTerm]);

  const handleViewProfile = (patientId) => {
    // Navigate to patient profile page
    window.location.href = `/patients/${patientId}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="patients-dashboard">
      <div className="patients-dashboard__header">
        <h1 className="patients-dashboard__title">Patients</h1>
        <p className="patients-dashboard__subtitle">
          Manage and search patient records
        </p>
      </div>

      {/* Search Bar */}
      <div className="patients-dashboard__search-container">
        <div className="patients-dashboard__search-wrapper">
          <input
            type="text"
            placeholder="Search by name or national ID..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="patients-dashboard__search-input"
          />
          <div className="patients-dashboard__search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="patients-dashboard__error">
          <div className="patients-dashboard__error-content">
            <h3 className="patients-dashboard__error-title">{error}</h3>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="patients-dashboard__loading">
          <div className="patients-dashboard__spinner">
            <svg className="patients-dashboard__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="patients-dashboard__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="patients-dashboard__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 018 5.291 0 12h4z"></path>
            </svg>
            Loading patients...
          </div>
        </div>
      ) : (
        /* Patients Table */
        <div className="patients-dashboard__table-container">
          {filteredPatients.length === 0 ? (
            <div className="patients-dashboard__empty-state">
              <div className="patients-dashboard__empty-content">
                <h3 className="patients-dashboard__empty-title">
                  {searchTerm ? 'No patients found matching your search' : 'No patients found'}
                </h3>
                <p className="patients-dashboard__empty-message">
                  {searchTerm 
                    ? 'Try adjusting your search terms or check the spelling'
                    : 'Add your first patient to get started'
                  }
                </p>
              </div>
            </div>
          ) : (
            <table className="patients-dashboard__table">
              <thead className="patients-dashboard__table-header">
                <tr>
                  <th className="patients-dashboard__table-header-cell">Name</th>
                  <th className="patients-dashboard__table-header-cell">National ID</th>
                  <th className="patients-dashboard__table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="patients-dashboard__table-body">
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} className="patients-dashboard__table-row">
                    <td className="patients-dashboard__table-cell">
                      <div className="patients-dashboard__patient-name">
                        {patient.full_name || 'N/A'}
                      </div>
                    </td>
                    <td className="patients-dashboard__table-cell">
                      <div className="patients-dashboard__patient-id">
                        {patient.national_id || 'N/A'}
                      </div>
                    </td>
                    <td className="patients-dashboard__table-cell">
                      <button
                        onClick={() => handleViewProfile(patient.id)}
                        className="patients-dashboard__view-profile-btn"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientsDashboard;
