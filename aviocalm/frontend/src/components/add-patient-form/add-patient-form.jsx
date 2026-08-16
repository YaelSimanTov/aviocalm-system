import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api';
import DateInputDDMMYYYY from '../shared/DateInputDDMMYYYY';
import './add-patient-form.css';

export const AddPatientForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    national_id: '',
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    address: '',
    medical_history: '',
    phobia_type: 'Flight',
    phobia_triggers: '',
    calming_factors: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    kit_id: ''
  });

  const [availableKits, setAvailableKits] = useState([]);
  const [isLoadingKits, setIsLoadingKits] = useState(false);

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdPatientId, setCreatedPatientId] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Fetch available kits when component mounts
  useEffect(() => {
    fetchAvailableKits();
  }, []);

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

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      // Step 1: Personal & Contact validation
      if (!formData.national_id.trim()) {
        newErrors.national_id = 'National ID is required';
      } else if (!/^\d+$/.test(formData.national_id.trim())) {
        newErrors.national_id = 'National ID must contain only numbers';
      }
      
      if (!formData.full_name.trim()) {
        newErrors.full_name = 'Full name is required';
      }
      
      if (!formData.date_of_birth.trim()) {
        newErrors.date_of_birth = 'Date of birth is required';
      } else if (formData.date_of_birth === 'INVALID_DATE') {
        newErrors.date_of_birth = 'Please enter a valid date in DD/MM/YYYY format';
      } else if (formData.date_of_birth === 'FUTURE_DATE') {
        newErrors.date_of_birth = 'Date of birth cannot be in the future';
      }
      
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (!/^\d+[-\s]?\d*$/.test(formData.phone.trim())) {
        newErrors.phone = 'Invalid phone format';
      }
      
      if (formData.email && formData.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
          newErrors.email = 'Invalid email format';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = () => {
    // Only validate current step when submitting
    return validateStep(currentStep);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setErrors({});
    
    try {
      // First call: Create patient
      // Explicitly whitelist only valid patient fields - exclude kit_id (handled separately)
      const patientPayload = {
        national_id: formData.national_id,
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email,
        date_of_birth: formData.date_of_birth,
        address: formData.address,
        medical_history: formData.medical_history,
        phobia_type: formData.phobia_type,
        phobia_triggers: formData.phobia_triggers,
        calming_factors: formData.calming_factors,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone
      };
      
      const patientResult = await apiRequest('/patients', {
        method: 'POST',
        body: JSON.stringify(patientPayload),
      });
      
      // If patient creation failed, surface server error and stop
      if (!patientResult.success) {
        setErrors({ general: patientResult.error || 'Failed to create patient' });
        setIsLoading(false);
        return;
      }
      
      // Extract patient ID from response
      const patientId = patientResult.data?.id || patientResult.data?.patient_id;
      
      if (!patientId) {
        setErrors({ general: 'Patient created but server did not return patient ID for kit assignment' });
        setIsLoading(false);
        return;
      }
      
      setCreatedPatientId(patientId);
      
      // Second call: Assign kit if selected
      if (formData.kit_id && formData.kit_id !== '') {
        setIsAssigning(true);
        
        const assignmentResult = await apiRequest('/v1/assignments/assign', {
          method: 'POST',
          body: JSON.stringify({
            patient_id: patientId,
            kit_id: formData.kit_id
          }),
        });
        
        setIsAssigning(false);
        
        if (!assignmentResult.success) {
          // Patient was created but assignment failed
          setSuccess(true);
          setErrors({ 
            general: 'Patient created successfully, but kit assignment failed: ' + (assignmentResult.error || 'Unknown error')
          });
          setIsLoading(false);
          return;
        }
      }
      
      // Full success
      setSuccess(true);
      setFormData({
        national_id: '',
        full_name: '',
        phone: '',
        email: '',
        date_of_birth: '',
        address: '',
        medical_history: '',
        phobia_type: 'Flight',
        phobia_triggers: '',
        calming_factors: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        kit_id: ''
      });
      setCurrentStep(1);
      
      // Reset success after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
      
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
      setIsAssigning(false);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div className="add-patient-form">
      <div className="add-patient-form__header">
        <h2 className="add-patient-form__title">Add New Patient</h2>
        <p className="add-patient-form__subtitle">
          Enter patient information to create a new record in system.
        </p>
        
        {/* Progress indicator */}
        <div className="add-patient-form__progress">
          <div className={`add-patient-form__step ${currentStep >= 1 ? 'active' : ''}`}>
            <span className="add-patient-form__step-number">1</span>
            <span className="add-patient-form__step-title">Personal & Contact</span>
          </div>
          <div className={`add-patient-form__step ${currentStep >= 2 ? 'active' : ''}`}>
            <span className="add-patient-form__step-number">2</span>
            <span className="add-patient-form__step-title">Medical & Phobia</span>
          </div>
          <div className={`add-patient-form__step ${currentStep >= 3 ? 'active' : ''}`}>
            <span className="add-patient-form__step-number">3</span>
            <span className="add-patient-form__step-title">Kit Assignment</span>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="add-patient-form__success">
          <div className="add-patient-form__success-content">
            <h3 className="add-patient-form__success-title">
              Patient created successfully!
            </h3>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errors.general && (
        <div className="add-patient-form__error">
          <div className="add-patient-form__error-content">
            <h3 className="add-patient-form__error-title">
              {errors.general}
            </h3>
          </div>
        </div>
      )}

      <form className="add-patient-form__form" onSubmit={handleSubmit}>
        {/* Step 1: Personal & Contact Information */}
        {currentStep === 1 && (
          <div className="add-patient-form__step-content">
            <div className="add-patient-form__row">
              {/* National ID */}
              <div className="add-patient-form__field">
                <label htmlFor="national_id" className="add-patient-form__label">
                  National ID *
                </label>
                <input
                  id="national_id"
                  name="national_id"
                  type="text"
                  required
                  className={`add-patient-form__input ${
                    errors.national_id ? 'add-patient-form__input--error' : ''
                  }`}
                  placeholder="Enter national ID number"
                  value={formData.national_id}
                  onChange={handleChange}
                />
                {errors.national_id && (
                  <p className="add-patient-form__error-text">{errors.national_id}</p>
                )}
              </div>

              {/* Full Name */}
              <div className="add-patient-form__field">
                <label htmlFor="full_name" className="add-patient-form__label">
                  Full Name *
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  className={`add-patient-form__input ${
                    errors.full_name ? 'add-patient-form__input--error' : ''
                  }`}
                  placeholder="Enter patient full name"
                  value={formData.full_name}
                  onChange={handleChange}
                />
                {errors.full_name && (
                  <p className="add-patient-form__error-text">{errors.full_name}</p>
                )}
              </div>
            </div>

            <div className="add-patient-form__row">
              {/* Phone */}
              <div className="add-patient-form__field">
                <label htmlFor="phone" className="add-patient-form__label">
                  Phone *
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className={`add-patient-form__input ${
                    errors.phone ? 'add-patient-form__input--error' : ''
                  }`}
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
                {errors.phone && (
                  <p className="add-patient-form__error-text">{errors.phone}</p>
                )}
              </div>

              {/* Email */}
              <div className="add-patient-form__field">
                <label htmlFor="email" className="add-patient-form__label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`add-patient-form__input ${
                    errors.email ? 'add-patient-form__input--error' : ''
                  }`}
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && (
                  <p className="add-patient-form__error-text">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="add-patient-form__row">
              {/* Date of Birth */}
              <div className="add-patient-form__field">
                <label htmlFor="date_of_birth" className="add-patient-form__label">
                  Date of Birth *
                </label>
                <DateInputDDMMYYYY
                  id="date_of_birth"
                  name="date_of_birth"
                  required
                  className={`add-patient-form__input ${
                    errors.date_of_birth ? 'add-patient-form__input--error' : ''
                  }`}
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  maxDate={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                />
                {errors.date_of_birth && (
                  <p className="add-patient-form__error-text">{errors.date_of_birth}</p>
                )}
              </div>

              {/* Address */}
              <div className="add-patient-form__field">
                <label htmlFor="address" className="add-patient-form__label">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  className="add-patient-form__textarea"
                  placeholder="Enter patient address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
            </div>

            <div className="add-patient-form__actions">
              <button
                type="button"
                onClick={nextStep}
                className="add-patient-form__button add-patient-form__button--secondary"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Medical & Phobia Information */}
        {currentStep === 2 && (
          <div className="add-patient-form__step-content">
            <div className="add-patient-form__row">
              {/* Phobia Type */}
              <div className="add-patient-form__field">
                <label htmlFor="phobia_type" className="add-patient-form__label">
                  Phobia Type
                </label>
                <select
                  id="phobia_type"
                  name="phobia_type"
                  className="add-patient-form__select"
                  value={formData.phobia_type}
                  onChange={handleChange}
                >
                  <option value="Flight">Flight Phobia</option>
                  <option value="Claustrophobia">Claustrophobia</option>
                  <option value="Acrophobia">Acrophobia</option>
                  <option value="Social">Social Anxiety</option>
                </select>
              </div>

              {/* Medical History */}
              <div className="add-patient-form__field">
                <label htmlFor="medical_history" className="add-patient-form__label">
                  Medical History
                </label>
                <textarea
                  id="medical_history"
                  name="medical_history"
                  className="add-patient-form__textarea"
                  placeholder="Enter relevant medical history"
                  value={formData.medical_history}
                  onChange={handleChange}
                  rows="4"
                />
              </div>
            </div>

            <div className="add-patient-form__row">
              {/* Phobia Triggers */}
              <div className="add-patient-form__field">
                <label htmlFor="phobia_triggers" className="add-patient-form__label">
                  Phobia Triggers
                </label>
                <textarea
                  id="phobia_triggers"
                  name="phobia_triggers"
                  className="add-patient-form__textarea"
                  placeholder="Describe what triggers the phobia"
                  value={formData.phobia_triggers}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              {/* Calming Factors */}
              <div className="add-patient-form__field">
                <label htmlFor="calming_factors" className="add-patient-form__label">
                  Calming Factors
                </label>
                <textarea
                  id="calming_factors"
                  name="calming_factors"
                  className="add-patient-form__textarea"
                  placeholder="Describe what helps calm the patient"
                  value={formData.calming_factors}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
            </div>

            <div className="add-patient-form__row">
              {/* Emergency Contact Name */}
              <div className="add-patient-form__field">
                <label htmlFor="emergency_contact_name" className="add-patient-form__label">
                  Emergency Contact Name
                </label>
                <input
                  id="emergency_contact_name"
                  name="emergency_contact_name"
                  type="text"
                  className="add-patient-form__input"
                  placeholder="Enter emergency contact name"
                  value={formData.emergency_contact_name}
                  onChange={handleChange}
                />
              </div>

              {/* Emergency Contact Phone */}
              <div className="add-patient-form__field">
                <label htmlFor="emergency_contact_phone" className="add-patient-form__label">
                  Emergency Contact Phone
                </label>
                <input
                  id="emergency_contact_phone"
                  name="emergency_contact_phone"
                  type="tel"
                  className="add-patient-form__input"
                  placeholder="Enter emergency contact phone"
                  value={formData.emergency_contact_phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="add-patient-form__actions">
              <button
                type="button"
                onClick={prevStep}
                className="add-patient-form__button add-patient-form__button--secondary"
              >
                Previous Step
              </button>
              
              <button
                type="button"
                onClick={nextStep}
                className="add-patient-form__button add-patient-form__button--secondary"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Equipment Assignment */}
        {currentStep === 3 && (
          <div className="add-patient-form__step-content">
            <div className="add-patient-form__row">
              {/* Kit Selection */}
              <div className="add-patient-form__field">
                <label htmlFor="kit_id" className="add-patient-form__label">
                  Equipment Kit (Optional)
                </label>
                <select
                  id="kit_id"
                  name="kit_id"
                  className="add-patient-form__select"
                  value={formData.kit_id}
                  onChange={handleChange}
                  disabled={isLoadingKits || isLoading}
                >
                  <option value="">Assign Later / No Kit</option>
                  {isLoadingKits ? (
                    <option value="" disabled>Loading available kits...</option>
                  ) : availableKits.length === 0 ? (
                    <option value="" disabled>No available kits</option>
                  ) : (
                    availableKits.map((kit) => (
                      <option key={kit.kit_id} value={kit.kit_id}>
                        Kit #{kit.kit_number} — {kit.vr_device_id}, {kit.watch_device_id}
                      </option>
                    ))
                  )}
                </select>
                <p className="add-patient-form__hint">
                  Select a kit to assign to this patient, or choose "Assign Later" to skip for now.
                </p>
              </div>
            </div>

            <div className="add-patient-form__actions">
              <button
                type="button"
                onClick={prevStep}
                className="add-patient-form__button add-patient-form__button--secondary"
                disabled={isLoading || isAssigning}
              >
                Previous Step
              </button>
              
              <button
                type="submit"
                disabled={isLoading || isAssigning}
                className={`add-patient-form__button ${
                  isLoading || isAssigning ? 'add-patient-form__button--loading' : ''
                }`}
              >
                {isLoading ? 'Creating Patient...' : isAssigning ? 'Assigning Kit...' : 'Create Patient'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default AddPatientForm;
