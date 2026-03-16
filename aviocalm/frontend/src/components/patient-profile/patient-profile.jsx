import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import './patient-profile.css';

export const PatientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Fetch patient data on component mount
  useEffect(() => {
    fetchPatient();
  }, [id]);

  const fetchPatient = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const result = await apiRequest(`/patients/${id}`);
      
      if (result.success) {
        setPatient(result.data);
        setFormData({
          full_name: result.data.full_name || '',
          national_id: result.data.national_id || '',
          phone: result.data.phone || '',
          email: result.data.email || '',
          date_of_birth: result.data.date_of_birth || '',
          address: result.data.address || '',
          medical_history: result.data.medical_history || '',
          phobia_type: result.data.phobia_type || 'Flight',
          phobia_triggers: result.data.phobia_triggers || '',
          calming_factors: result.data.calming_factors || '',
          emergency_contact_name: result.data.emergency_contact_name || '',
          emergency_contact_phone: result.data.emergency_contact_phone || ''
        });
      } else {
        setError(result.error || 'Failed to fetch patient data');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab !== 'personal') {
      setIsEditing(false); // Exit edit mode when switching away from personal tab
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setSuccessMessage('');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Required fields validation
    if (!formData.full_name || formData.full_name.trim() === '') {
      errors.full_name = 'Full name is required';
    }
    
    if (!formData.national_id || formData.national_id.trim() === '') {
      errors.national_id = 'National ID is required';
    }
    
    if (!formData.date_of_birth || formData.date_of_birth.trim() === '') {
      errors.date_of_birth = 'Date of birth is required';
    }
    
    // National ID format validation (numbers only)
    if (formData.national_id && !/^\d+$/.test(formData.national_id.trim())) {
      errors.national_id = 'National ID must contain only numbers';
    }
    
    // Email format validation (if provided)
    if (formData.email && formData.email.trim() !== '') {
      const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    // Phone format validation (if provided)
    if (formData.phone && formData.phone.trim() !== '') {
      const phoneRegex = /^[\d\s\-\+\(\)]*$/;
      if (!phoneRegex.test(formData.phone.trim())) {
        errors.phone = 'Please enter a valid phone number (numbers, spaces, dashes, plus, parentheses allowed)';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return; // Stop if validation fails
    }
    
    try {
      setIsSaving(true);
      setSuccessMessage('');
      
      const result = await apiRequest(`/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      
      if (result.success) {
        setPatient(result.data);
        setIsEditing(false);
        setSuccessMessage('Patient information updated successfully!');
        setFormErrors({}); // Clear form errors
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to update patient');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original patient data
    if (patient) {
      setFormData({
        full_name: patient.full_name || '',
        national_id: patient.national_id || '',
        phone: patient.phone || '',
        email: patient.email || '',
        date_of_birth: patient.date_of_birth || '',
        address: patient.address || '',
        medical_history: patient.medical_history || '',
        phobia_type: patient.phobia_type || 'Flight',
        phobia_triggers: patient.phobia_triggers || '',
        calming_factors: patient.calming_factors || '',
        emergency_contact_name: patient.emergency_contact_name || '',
        emergency_contact_phone: patient.emergency_contact_phone || ''
      });
    }
    setIsEditing(false);
    setSuccessMessage('');
    setFormErrors({}); // Clear form errors
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const calculateAge = (dateString) => {
    if (!dateString) return 'N/A';
    const birthDate = new Date(dateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="patient-profile">
        <div className="patient-profile__loading">
          <div className="patient-profile__spinner">
            <svg className="patient-profile__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="patient-profile__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="patient-profile__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 018 5.291 0 12h4z"></path>
            </svg>
            Loading patient data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-profile">
        <div className="patient-profile__error">
          <div className="patient-profile__error-content">
            <h3 className="patient-profile__error-title">{error}</h3>
            <button onClick={() => navigate('/patients')} className="patient-profile__back-btn">
              Back to Patients
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="patient-profile">
        <div className="patient-profile__not-found">
          <h3 className="patient-profile__not-found-title">Patient not found</h3>
          <button onClick={() => navigate('/patients')} className="patient-profile__back-btn">
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-profile">
      {/* Header Section */}
      <div className="patient-profile__header">
        <button onClick={() => navigate('/patients')} className="patient-profile__back-btn">
          ← Back to Patients
        </button>
        <h1 className="patient-profile__title">Patient Profile</h1>
      </div>

      {/* Patient Summary Card */}
      <div className="patient-profile__summary">
        <div className="patient-profile__summary-card">
          <div className="patient-profile__summary-info">
            <h2 className="patient-profile__patient-name">{patient.full_name}</h2>
            <div className="patient-profile__summary-details">
              <div className="patient-profile__summary-item">
                <span className="patient-profile__summary-label">National ID:</span>
                <span className="patient-profile__summary-value">{patient.national_id}</span>
              </div>
              <div className="patient-profile__summary-item">
                <span className="patient-profile__summary-label">Phobia Type:</span>
                <span className="patient-profile__summary-value">{patient.phobia_type}</span>
              </div>
              <div className="patient-profile__summary-item">
                <span className="patient-profile__summary-label">Age:</span>
                <span className="patient-profile__summary-value">{calculateAge(patient.date_of_birth)} years</span>
              </div>
              <div className="patient-profile__summary-item">
                <span className="patient-profile__summary-label">Date of Birth:</span>
                <span className="patient-profile__summary-value">{formatDate(patient.date_of_birth)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="patient-profile__success">
          <div className="patient-profile__success-content">
            <h3 className="patient-profile__success-title">{successMessage}</h3>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="patient-profile__error">
          <div className="patient-profile__error-content">
            <h3 className="patient-profile__error-title">{error}</h3>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="patient-profile__tabs">
        <div className="patient-profile__tab-navigation">
          <button
            className={`patient-profile__tab-button ${activeTab === 'personal' ? 'active' : ''}`}
            onClick={() => handleTabChange('personal')}
          >
            Personal Info
          </button>
          <button
            className={`patient-profile__tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            Treatment History
          </button>
          <button
            className={`patient-profile__tab-button ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => handleTabChange('appointments')}
          >
            Appointments
          </button>
        </div>

        {/* Tab Content */}
        <div className="patient-profile__tab-content">
          {activeTab === 'personal' && (
            <div className="patient-profile__personal-tab">
              <div className="patient-profile__tab-header">
                <h3 className="patient-profile__tab-title">Personal Information</h3>
                {!isEditing ? (
                  <button onClick={handleEditToggle} className="patient-profile__edit-btn">
                    Edit
                  </button>
                ) : (
                  <div className="patient-profile__edit-actions">
                    <button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="patient-profile__save-btn"
                    >
                      {isSaving ? (
                        <>
                          <div className="patient-profile__btn-spinner">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 018 5.291 0 12h4z"></path>
                            </svg>
                            Saving...
                          </div>
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                    <button onClick={handleCancel} className="patient-profile__cancel-btn">
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="patient-profile__form">
                <div className="patient-profile__form-grid">
                  {/* Personal Information */}
                  <div className="patient-profile__form-section">
                    <h4 className="patient-profile__section-title">Personal Information</h4>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Full Name *</label>
                        <input
                          type="text"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`patient-profile__input ${formErrors.full_name ? 'patient-profile__input--error' : ''}`}
                        />
                        {formErrors.full_name && (
                          <p className="patient-profile__error-text">{formErrors.full_name}</p>
                        )}
                      </div>
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">National ID *</label>
                        <input
                          type="text"
                          name="national_id"
                          value={formData.national_id}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`patient-profile__input ${formErrors.national_id ? 'patient-profile__input--error' : ''}`}
                        />
                        {formErrors.national_id && (
                          <p className="patient-profile__error-text">{formErrors.national_id}</p>
                        )}
                      </div>
                    </div>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Phone</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`patient-profile__input ${formErrors.phone ? 'patient-profile__input--error' : ''}`}
                        />
                        {formErrors.phone && (
                          <p className="patient-profile__error-text">{formErrors.phone}</p>
                        )}
                      </div>
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`patient-profile__input ${formErrors.email ? 'patient-profile__input--error' : ''}`}
                        />
                        {formErrors.email && (
                          <p className="patient-profile__error-text">{formErrors.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Date of Birth *</label>
                        <input
                          type="date"
                          name="date_of_birth"
                          value={formData.date_of_birth}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`patient-profile__input ${formErrors.date_of_birth ? 'patient-profile__input--error' : ''}`}
                        />
                        {formErrors.date_of_birth && (
                          <p className="patient-profile__error-text">{formErrors.date_of_birth}</p>
                        )}
                      </div>
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Phobia Type</label>
                        <select
                          name="phobia_type"
                          value={formData.phobia_type}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__select"
                        >
                          <option value="Flight">Flight Phobia</option>
                          <option value="Claustrophobia">Claustrophobia</option>
                          <option value="Acrophobia">Acrophobia</option>
                          <option value="Social">Social Anxiety</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div className="patient-profile__form-section">
                    <h4 className="patient-profile__section-title">Medical Information</h4>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field full-width">
                        <label className="patient-profile__label">Address</label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__textarea"
                          rows="2"
                        />
                      </div>
                    </div>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field full-width">
                        <label className="patient-profile__label">Medical History</label>
                        <textarea
                          name="medical_history"
                          value={formData.medical_history}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__textarea"
                          rows="4"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Phobia Information */}
                  <div className="patient-profile__form-section">
                    <h4 className="patient-profile__section-title">Phobia Information</h4>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field full-width">
                        <label className="patient-profile__label">Phobia Triggers</label>
                        <textarea
                          name="phobia_triggers"
                          value={formData.phobia_triggers}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__textarea"
                          rows="3"
                        />
                      </div>
                    </div>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field full-width">
                        <label className="patient-profile__label">Calming Factors</label>
                        <textarea
                          name="calming_factors"
                          value={formData.calming_factors}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__textarea"
                          rows="3"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="patient-profile__form-section">
                    <h4 className="patient-profile__section-title">Emergency Contact</h4>
                    <div className="patient-profile__form-row">
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Contact Name</label>
                        <input
                          type="text"
                          name="emergency_contact_name"
                          value={formData.emergency_contact_name}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__input"
                        />
                      </div>
                      <div className="patient-profile__form-field">
                        <label className="patient-profile__label">Contact Phone</label>
                        <input
                          type="tel"
                          name="emergency_contact_phone"
                          value={formData.emergency_contact_phone}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="patient-profile__input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="patient-profile__history-tab">
              <div className="patient-profile__empty-state">
                <h3 className="patient-profile__empty-title">No treatment history yet</h3>
                <p className="patient-profile__empty-message">
                  Treatment sessions and progress data will appear here once VR therapy sessions begin.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="patient-profile__appointments-tab">
              <div className="patient-profile__empty-state">
                <h3 className="patient-profile__empty-title">No upcoming appointments</h3>
                <p className="patient-profile__empty-message">
                  Scheduled therapy sessions will appear here once appointments are created.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfile;
