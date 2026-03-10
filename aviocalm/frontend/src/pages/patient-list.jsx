import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import './patient-list.css';

// Mock patient data for demonstration
const mockPatients = [
  { id: 'P001', name: 'John Smith', age: 35, status: 'Active', lastSession: '2024-03-10' },
  { id: 'P002', name: 'Sarah Johnson', age: 28, status: 'Active', lastSession: '2024-03-09' },
  { id: 'P003', name: 'Michael Davis', age: 42, status: 'Pending', lastSession: '2024-03-08' },
  { id: 'P004', name: 'Emily Wilson', age: 31, status: 'Active', lastSession: '2024-03-07' },
  { id: 'P005', name: 'Robert Brown', age: 39, status: 'Closed', lastSession: '2024-03-05' },
];

export const PatientList = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState(mockPatients);

  // Filter patients based on search query
  useEffect(() => {
    const filtered = mockPatients.filter(patient => 
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredPatients(filtered);
  }, [searchQuery]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
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
      {/* Search Bar */}
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

      {/* Results Count */}
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

      {/* Patient Table */}
      <div className="patient-list__table-container">
        <table className="patient-list__table">
          <thead>
            <tr>
              <th>Patient ID</th>
              <th>Name</th>
              <th>Age</th>
              <th>Status</th>
              <th>Last Session</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.id} className="patient-list__row">
                <td className="patient-list__id">{patient.id}</td>
                <td className="patient-list__name">{patient.name}</td>
                <td className="patient-list__age">{patient.age}</td>
                <td>
                  <span className={`patient-list__status ${getStatusColor(patient.status)}`}>
                    {patient.status}
                  </span>
                </td>
                <td className="patient-list__date">{patient.lastSession}</td>
                <td>
                  <button className="patient-list__action-btn">
                    View Details
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
