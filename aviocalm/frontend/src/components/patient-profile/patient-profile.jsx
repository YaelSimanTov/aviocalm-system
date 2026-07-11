import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { TreatmentHistory } from '../treatment-history/treatment-history';
import './patient-profile.css';

export const PatientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [isLoadingAssignment, setIsLoadingAssignment] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableKits, setAvailableKits] = useState([]);
  const [isLoadingKits, setIsLoadingKits] = useState(false);
  const [selectedKitId, setSelectedKitId] = useState('');
  const [isReleasing, setIsReleasing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Fetch patient data on component mount
  useEffect(() => {
    fetchPatient();
    fetchAssignment();
  }, [id]);

  // If arriving from the Notification Center, switch to the requested tab automatically.
  // The empty dependency array ensures this fires once on mount only.
  useEffect(() => {
    if (location.state?.targetTab) {
      setActiveTab(location.state.targetTab);
    }
  }, []);

  // Fetch clinical notes when clinical-notes tab is activated
  useEffect(() => {
    if (activeTab === 'clinical-notes') {
      fetchClinicalNotes();
    }
  }, [activeTab, id]);

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

  // Fetch current assignment for this patient
  const fetchAssignment = async () => {
    try {
      setIsLoadingAssignment(true);
      const result = await apiRequest(`/v1/assignments/patient/${id}`);
      if (result.success && result.data) {
        setCurrentAssignment(result.data);
      } else {
        setCurrentAssignment(null);
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      setCurrentAssignment(null);
    } finally {
      setIsLoadingAssignment(false);
    }
  };

  // Fetch available kits for assign modal
  const fetchAvailableKits = async () => {
    try {
      setIsLoadingKits(true);
      const result = await apiRequest('/v1/kits/available', { method: 'GET' });
      if (result.success && result.data) {
        setAvailableKits(result.data);
      }
    } catch (error) {
      console.error('Error fetching available kits:', error);
    } finally {
      setIsLoadingKits(false);
    }
  };

  // Handle release kit action
  const handleReleaseKit = async () => {
    try {
      setIsReleasing(true);
      const result = await apiRequest('/v1/assignments/release', {
        method: 'PATCH',
        body: JSON.stringify({ patient_id: id })
      });
      
      if (result.success) {
        setSuccessMessage('Kit released successfully!');
        setShowReturnModal(false);
        await fetchAssignment();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to release kit');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsReleasing(false);
    }
  };

  // Handle assign kit action
  const handleAssignKit = async () => {
    if (!selectedKitId) {
      setError('Please select a kit to assign');
      return;
    }
    
    try {
      setIsAssigning(true);
      const result = await apiRequest('/v1/assignments/assign', {
        method: 'POST',
        body: JSON.stringify({ patient_id: id, kit_id: selectedKitId })
      });
      
      if (result.success) {
        setSuccessMessage('Kit assigned successfully!');
        setShowAssignModal(false);
        setSelectedKitId('');
        await fetchAssignment();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to assign kit');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Open assign modal and fetch available kits
  const handleOpenAssignModal = () => {
    setShowAssignModal(true);
    setSelectedKitId('');
    fetchAvailableKits();
  };

  // Fetch clinical notes for the patient
  const fetchClinicalNotes = async () => {
    try {
      setIsLoadingNotes(true);
      const result = await apiRequest(`/patients/${id}/notes`);
      if (result.success) {
        setClinicalNotes(result.data);
      } else {
        console.error('Failed to fetch clinical notes:', result.error);
      }
    } catch (error) {
      console.error('Error fetching clinical notes:', error);
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Save a new clinical note
  const handleSaveNote = async () => {
    if (!newNoteContent.trim()) {
      return;
    }

    try {
      setIsSavingNote(true);
      const result = await apiRequest(`/patients/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note_content: newNoteContent })
      });

      if (result.success) {
        // Clear the textarea
        setNewNoteContent('');
        // Add the new note to the top of the list
        setClinicalNotes(prevNotes => [result.data, ...prevNotes]);
        setSuccessMessage('Clinical note saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(result.error || 'Failed to save clinical note');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setIsSavingNote(false);
    }
  };

  // Format date for display
  const formatNoteDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="patient-profile">
        <div className="patient-profile__loading">
          <div className="patient-profile__spinner">
            <svg className="patient-profile__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="patient-profile__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="patient-profile__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
            className={`patient-profile__tab-button ${activeTab === 'clinical-notes' ? 'active' : ''}`}
            onClick={() => handleTabChange('clinical-notes')}
          >
            Therapist Notes
          </button>
        </div>

        {/* Tab Content */}
        <div className="patient-profile__tab-content">
          {activeTab === 'personal' && (
            <div className="patient-profile__personal-tab">
              <div className="patient-profile__tab-header">
                <h3 className="patient-profile__tab-title">📝 Personal Information</h3>
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
                              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                          disabled={true}
                          className={`patient-profile__input patient-profile__input--disabled ${formErrors.national_id ? 'patient-profile__input--error' : ''}`}
                          title="National ID cannot be edited after patient creation"
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
                          value={formData.date_of_birth ? formData.date_of_birth.split('T')[0] : ''}
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

              {/* Active Equipment Card */}
              <div className="patient-profile__equipment-section">
                <h4 className="patient-profile__section-title">📦 Active Equipment</h4>
                {isLoadingAssignment ? (
                  <div className="patient-profile__equipment-loading">
                    Loading equipment information...
                  </div>
                ) : currentAssignment ? (
                  <div className="patient-profile__equipment-card patient-profile__equipment-card--assigned">
                    <div className="patient-profile__equipment-details">
                      <div className="patient-profile__equipment-item">
                        <span className="patient-profile__equipment-label">Kit:</span>
                        <span className="patient-profile__equipment-value">Kit #{currentAssignment.kit_number}</span>
                      </div>
                      <div className="patient-profile__equipment-item">
                        <span className="patient-profile__equipment-label">VR Device ID:</span>
                        <span className="patient-profile__equipment-value">#{currentAssignment.vr_device_id?.slice(0, 8)}...</span>
                      </div>
                      <div className="patient-profile__equipment-item">
                        <span className="patient-profile__equipment-label">Watch Device ID:</span>
                        <span className="patient-profile__equipment-value">#{currentAssignment.watch_device_id?.slice(0, 8)}...</span>
                      </div>
                      <div className="patient-profile__equipment-item">
                        <span className="patient-profile__equipment-label">Assigned Date:</span>
                        <span className="patient-profile__equipment-value">
                          {currentAssignment.assigned_at ? new Date(currentAssignment.assigned_at).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowReturnModal(true)}
                      className="patient-profile__return-kit-btn"
                    >
                      Return Kit
                    </button>
                  </div>
                ) : (
                  <div className="patient-profile__equipment-card patient-profile__equipment-card--empty">
                    <div className="patient-profile__equipment-empty-state">
                      <p className="patient-profile__equipment-empty-message">
                        No equipment currently assigned
                      </p>
                      <button
                        onClick={handleOpenAssignModal}
                        className="patient-profile__assign-kit-btn"
                      >
                        Assign Kit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="patient-profile__history-tab">
              <div className="patient-profile__tab-header">
                <h3 className="patient-profile__tab-title">📈 Treatment History</h3>
              </div>
              <TreatmentHistory patientId={id} />
            </div>
          )}

          {activeTab === 'clinical-notes' && (
            <div className="patient-profile__clinical-notes-tab">
              <div className="patient-profile__tab-header">
                <h3 className="patient-profile__tab-title">📝 Therapist Notes</h3>
              </div>

              {/* Input Section */}
              <div className="patient-profile__notes-input-section">
                <textarea
                  className="patient-profile__notes-textarea"
                  placeholder="Write a session summary, clinical observation, or patient feedback..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  rows="4"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={isSavingNote || !newNoteContent.trim()}
                  className="patient-profile__save-note-btn"
                >
                  {isSavingNote ? (
                    <>
                      <div className="patient-profile__btn-spinner">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </div>
                    </>
                  ) : (
                    'Save Note'
                  )}
                </button>
              </div>

              {/* History Feed */}
              <div className="patient-profile__notes-history">
                <h4 className="patient-profile__notes-history-title">Previous Notes</h4>
                {isLoadingNotes ? (
                  <div className="patient-profile__notes-loading">
                    Loading therapist notes...
                  </div>
                ) : clinicalNotes.length === 0 ? (
                  <div className="patient-profile__notes-empty">
                    <p className="patient-profile__notes-empty-message">
                      No therapist notes yet. Write your first note above.
                    </p>
                  </div>
                ) : (
                  <div className="patient-profile__notes-list">
                    {clinicalNotes.map((note) => (
                      <div key={note.id} className="patient-profile__note-card">
                        <div className="patient-profile__note-content">
                          {note.note_content}
                        </div>
                        <div className="patient-profile__note-date">
                          {formatNoteDate(note.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return Kit Confirmation Modal */}
      {showReturnModal && (
        <div className="patient-profile__modal-overlay">
          <div className="patient-profile__modal">
            <div className="patient-profile__modal-header">
              <h3 className="patient-profile__modal-title">Return Kit</h3>
              <button
                onClick={() => setShowReturnModal(false)}
                className="patient-profile__modal-close"
              >
                ×
              </button>
            </div>
            <div className="patient-profile__modal-body">
              <p className="patient-profile__modal-message">
                Are you sure you want to return the assigned kit? This action will release the equipment from the patient.
              </p>
            </div>
            <div className="patient-profile__modal-footer">
              <button
                onClick={() => setShowReturnModal(false)}
                className="patient-profile__modal-btn patient-profile__modal-btn--secondary"
                disabled={isReleasing}
              >
                Cancel
              </button>
              <button
                onClick={handleReleaseKit}
                disabled={isReleasing}
                className="patient-profile__modal-btn patient-profile__modal-btn--danger"
              >
                {isReleasing ? 'Returning...' : 'Return Kit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Kit Modal */}
      {showAssignModal && (
        <div className="patient-profile__modal-overlay">
          <div className="patient-profile__modal">
            <div className="patient-profile__modal-header">
              <h3 className="patient-profile__modal-title">Assign Kit</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="patient-profile__modal-close"
              >
                ×
              </button>
            </div>
            <div className="patient-profile__modal-body">
              {isLoadingKits ? (
                <p className="patient-profile__modal-message">Loading available kits...</p>
              ) : availableKits.length === 0 ? (
                <p className="patient-profile__modal-message">No available kits to assign.</p>
              ) : (
                <div className="patient-profile__modal-form">
                  <label className="patient-profile__label">Select a Kit:</label>
                  <select
                    value={selectedKitId}
                    onChange={(e) => setSelectedKitId(e.target.value)}
                    className="patient-profile__select"
                    disabled={isAssigning}
                  >
                    <option value="">-- Select a kit --</option>
                    {availableKits.map((kit) => (
                      <option key={kit.kit_id} value={kit.kit_id}>
                        Kit #{kit.kit_number} — {kit.vr_device_id}, {kit.watch_device_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="patient-profile__modal-footer">
              <button
                onClick={() => setShowAssignModal(false)}
                className="patient-profile__modal-btn patient-profile__modal-btn--secondary"
                disabled={isAssigning}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignKit}
                disabled={isAssigning || !selectedKitId}
                className="patient-profile__modal-btn patient-profile__modal-btn--primary"
              >
                {isAssigning ? 'Assigning...' : 'Assign Kit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientProfile;
