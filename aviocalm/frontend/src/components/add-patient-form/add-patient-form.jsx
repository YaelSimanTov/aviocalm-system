import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';
import './add-patient-form.css';

export const AddPatientForm = () => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    age: '',
    address: '',
    medical_history: '',
    phobia_type: 'Flight',
    phobia_triggers: '',
    calming_factors: ''
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.age || formData.age < 1 || formData.age > 150) {
      newErrors.age = 'Valid age is required (1-150)';
    }
    
    if (!formData.email && formData.email.trim()) {
      newErrors.email = 'Invalid email format';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await apiRequest('/patients', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      if (result.success) {
        setSuccess(true);
        setFormData({
          id: '',
          name: '',
          phone: '',
          email: '',
          age: '',
          address: '',
          medical_history: '',
          phobia_type: 'Flight',
          phobia_triggers: '',
          calming_factors: ''
        });
        
        // Reset success after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setErrors({ general: result.error || 'Failed to create patient' });
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="add-patient-form">
      <div className="add-patient-form__header">
        <h2 className="add-patient-form__title">Add New Patient</h2>
        <p className="add-patient-form__subtitle">
          Enter patient information to create a new record in the system.
        </p>
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
        <div className="add-patient-form__row">
          {/* Patient ID */}
          <div className="add-patient-form__field">
            <label htmlFor="id" className="add-patient-form__label">
              Patient ID
            </label>
            <input
              id="id"
              name="id"
              type="text"
              className={`add-patient-form__input ${
                errors.id ? 'add-patient-form__input--error' : ''
              }`}
              placeholder="Auto-generated or enter custom ID"
              value={formData.id}
              onChange={handleChange}
            />
            {errors.id && (
              <p className="add-patient-form__error-text">{errors.id}</p>
            )}
          </div>

          {/* Name */}
          <div className="add-patient-form__field">
            <label htmlFor="name" className="add-patient-form__label">
              Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className={`add-patient-form__input ${
                errors.name ? 'add-patient-form__input--error' : ''
              }`}
              placeholder="Enter patient full name"
              value={formData.name}
              onChange={handleChange}
            />
            {errors.name && (
              <p className="add-patient-form__error-text">{errors.name}</p>
            )}
          </div>
        </div>

        <div className="add-patient-form__row">
          {/* Phone */}
          <div className="add-patient-form__field">
            <label htmlFor="phone" className="add-patient-form__label">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
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
          {/* Age */}
          <div className="add-patient-form__field">
            <label htmlFor="age" className="add-patient-form__label">
              Age *
            </label>
            <input
              id="age"
              name="age"
              type="number"
              required
              min="1"
              max="150"
              className={`add-patient-form__input ${
                errors.age ? 'add-patient-form__input--error' : ''
              }`}
              placeholder="Enter patient age"
              value={formData.age}
              onChange={handleChange}
            />
            {errors.age && (
              <p className="add-patient-form__error-text">{errors.age}</p>
            )}
          </div>

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
        </div>

        {/* Address */}
        <div className="add-patient-form__field">
          <label htmlFor="address" className="add-patient-form__label">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            className={`add-patient-form__textarea ${
              errors.address ? 'add-patient-form__input--error' : ''
            }`}
            placeholder="Enter patient address"
            value={formData.address}
            onChange={handleChange}
            rows="3"
          />
          {errors.address && (
            <p className="add-patient-form__error-text">{errors.address}</p>
          )}
        </div>

        {/* Medical History */}
        <div className="add-patient-form__field">
          <label htmlFor="medical_history" className="add-patient-form__label">
            Medical History
          </label>
          <textarea
            id="medical_history"
            name="medical_history"
            className={`add-patient-form__textarea ${
              errors.medical_history ? 'add-patient-form__input--error' : ''
            }`}
            placeholder="Enter relevant medical history"
            value={formData.medical_history}
            onChange={handleChange}
            rows="4"
          />
          {errors.medical_history && (
            <p className="add-patient-form__error-text">{errors.medical_history}</p>
          )}
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
              className={`add-patient-form__textarea ${
                errors.phobia_triggers ? 'add-patient-form__input--error' : ''
              }`}
              placeholder="Describe what triggers the phobia"
              value={formData.phobia_triggers}
              onChange={handleChange}
              rows="3"
            />
            {errors.phobia_triggers && (
              <p className="add-patient-form__error-text">{errors.phobia_triggers}</p>
            )}
          </div>

          {/* Calming Factors */}
          <div className="add-patient-form__field">
            <label htmlFor="calming_factors" className="add-patient-form__label">
              Calming Factors
            </label>
            <textarea
              id="calming_factors"
              name="calming_factors"
              className={`add-patient-form__textarea ${
                errors.calming_factors ? 'add-patient-form__input--error' : ''
              }`}
              placeholder="Describe what helps calm the patient"
              value={formData.calming_factors}
              onChange={handleChange}
              rows="3"
            />
            {errors.calming_factors && (
              <p className="add-patient-form__error-text">{errors.calming_factors}</p>
            )}
          </div>
        </div>

        <div className="add-patient-form__actions">
          <button
            type="submit"
            disabled={isLoading}
            className={`add-patient-form__button ${
              isLoading ? 'add-patient-form__button--loading' : ''
            }`}
          >
            {isLoading ? (
              <>
                <div className="add-patient-form__spinner">
                  <svg className="add-patient-form__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="add-patient-form__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="add-patient-form__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Patient...
                </div>
              </>
            ) : (
              'Create Patient'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddPatientForm;
