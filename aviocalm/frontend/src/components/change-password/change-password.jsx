 import React, { useState, useEffect } from 'react';
import './change-password.css';

export const ChangePasswordForm = ({ onSubmit, isLoading, error, success, fieldErrors }) => {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState({
    oldPassword: false,
    newPassword: false,
    confirmPassword: false
  });

  // Password requirements state
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  // Real-time validation for new password
  const validateNewPassword = (password) => {
    const errors = {};
    
    if (password.length < 8) {
      errors.length = 'Password must be at least 8 characters long.';
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.uppercase = 'Must include an uppercase letter.';
    }
    
    if (!/[a-z]/.test(password)) {
      errors.lowercase = 'Must include a lowercase letter.';
    }
    
    if (!/[0-9]/.test(password)) {
      errors.special = 'Must include a number';
    }
    if (!/[!@#$%]/.test(password)) {
      errors.special = 'Must include a special character';
    }
    
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Real-time validation for new password
    if (name === 'newPassword') {
      const newPasswordErrors = validateNewPassword(value);
      setValidationErrors(prev => ({
        ...prev,
        newPassword: Object.keys(newPasswordErrors).length > 0 ? newPasswordErrors : ''
      }));
      
      // Update password requirements in real-time
      setPasswordRequirements({
        length: value.length >= 8,
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        number: /[0-9]/.test(value),
        special: /[!@#$%]/.test(value)
      });
    }
    
    // Validate password match when confirm password changes
    if (name === 'confirmPassword' || (name === 'newPassword' && formData.confirmPassword)) {
      const newPassword = name === 'newPassword' ? value : formData.newPassword;
      const confirmPassword = name === 'confirmPassword' ? value : formData.confirmPassword;
      
      if (confirmPassword && newPassword !== confirmPassword) {
        setValidationErrors(prev => ({
          ...prev,
          confirmPassword: 'Passwords do not match.'
        }));
      } else if (validationErrors.confirmPassword) {
        setValidationErrors(prev => ({
          ...prev,
          confirmPassword: ''
        }));
      }
    }
  };

  const togglePasswordVisibility = (fieldName) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const validateForm = () => {
    const errors = {};
    
    // Check required fields
    if (!formData.oldPassword.trim()) {
      errors.oldPassword = 'Required field';
    }
    
    if (!formData.newPassword.trim()) {
      errors.newPassword = 'Required field';
    }
    
    if (!formData.confirmPassword.trim()) {
      errors.confirmPassword = 'Required field';
    }
    
    // Validate new password requirements
    const newPasswordErrors = validateNewPassword(formData.newPassword);
    if (Object.keys(newPasswordErrors).length > 0) {
      errors.newPassword = newPasswordErrors;
    }
    
    // Check password match
    if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData.oldPassword, formData.newPassword);
    }
  };

  const getErrorMessage = (error) => {
    if (typeof error === 'object') {
      return Object.values(error).join(' ');
    }
    return error;
  };

  return (
    <div className="change-password">
      <div className="change-password__header">
        <h2 className="change-password__title">Change Password</h2>
        <p className="change-password__subtitle">
          For your security, please choose a strong password that meets the requirements below.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="change-password__success">
          <div className="change-password__success-content">
            <h3 className="change-password__success-title">
              Your password has been change successfully! Redirecting to login...
            </h3>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="change-password__error">
          <div className="change-password__error-content">
            <h3 className="change-password__error-title">
              {error}
            </h3>
          </div>
        </div>
      )}

      <form className="change-password__form" onSubmit={handleSubmit} noValidate>
        {/* Old Password Field */}
        <div className="change-password__field">
          <label htmlFor="oldPassword" className="change-password__label">
            Old Password
          </label>
          <div className="change-password__input-wrapper">
            <input
              id="oldPassword"
              name="oldPassword"
              type={showPasswords.oldPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className={`change-password__input ${
                validationErrors.oldPassword || fieldErrors.oldPassword ? 'change-password__input--error' : ''
              }`}
              placeholder="Enter your current password"
              value={formData.oldPassword}
              onChange={handleChange}
            />
            <button
              type="button"
              className="change-password__visibility-toggle"
              onClick={() => togglePasswordVisibility('oldPassword')}
            >
              {showPasswords.oldPassword ? (
                <svg className="change-password__eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="change-password__eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
          {validationErrors.oldPassword || fieldErrors.oldPassword ? (
            <p className="change-password__validation-error">
              {fieldErrors.oldPassword || validationErrors.oldPassword}
            </p>
          ) : null}
        </div>

        {/* New Password Field */}
        <div className="change-password__field">
          <label htmlFor="newPassword" className="change-password__label">
            New Password
          </label>
          <div className="change-password__input-wrapper">
            <input
              id="newPassword"
              name="newPassword"
              type={showPasswords.newPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              className={`change-password__input ${
                validationErrors.newPassword ? 'change-password__input--error' : ''
              }`}
              placeholder="Enter your new password"
              value={formData.newPassword}
              onChange={handleChange}
            />
            <button
              type="button"
              className="change-password__visibility-toggle"
              onClick={() => togglePasswordVisibility('newPassword')}
            >
              {showPasswords.newPassword ? (
                <svg className="change-password__eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="change-password__eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
          {validationErrors.newPassword && (
            <p className="change-password__validation-error">
              {getErrorMessage(validationErrors.newPassword)}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="change-password__field">
          <label htmlFor="confirmPassword" className="change-password__label">
            Confirm New Password
          </label>
          <div className="change-password__input-wrapper">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showPasswords.confirmPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              className={`change-password__input ${
                validationErrors.confirmPassword ? 'change-password__input--error' : ''
              }`}
              placeholder="Confirm your new password"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            <button
              type="button"
              className="change-password__visibility-toggle"
              onClick={() => togglePasswordVisibility('confirmPassword')}
            >
              {showPasswords.confirmPassword ? (
                <svg className="change-password__eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="change-password__eye-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              )}
            </button>
          </div>
          {(validationErrors.confirmPassword || fieldErrors.confirmPassword) && (
            <p className="change-password__validation-error">
              {validationErrors.confirmPassword || fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Dynamic Password Requirements */}
        <div className="change-password__requirements">
          <h4 className="change-password__requirements-title">Password Requirements:</h4>
          <ul className="change-password__requirements-list">
            <li className={`change-password__requirement ${passwordRequirements.length ? 'change-password__requirement--met' : ''}`}>
              {passwordRequirements.length ? (
                <svg className="change-password__check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
              At least 8 characters long
            </li>
            <li className={`change-password__requirement ${passwordRequirements.uppercase ? 'change-password__requirement--met' : ''}`}>
              {passwordRequirements.uppercase ? (
                <svg className="change-password__check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
              Contains uppercase letter (A-Z)
            </li>
            <li className={`change-password__requirement ${passwordRequirements.lowercase ? 'change-password__requirement--met' : ''}`}>
              {passwordRequirements.lowercase ? (
                <svg className="change-password__check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
              Contains lowercase letter (a-z)
            </li>
            <li className={`change-password__requirement ${passwordRequirements.number ? 'change-password__requirement--met' : ''}`}>
              {passwordRequirements.number ? (
                <svg className="change-password__check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
              Contains number (0-9)
            </li>
            <li className={`change-password__requirement ${passwordRequirements.special ? 'change-password__requirement--met' : ''}`}>
              {passwordRequirements.special ? (
                <svg className="change-password__check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
              Contains special character (!@#$%)
            </li>
          </ul>
        </div>

        <div className="change-password__submit">
          <button
            type="submit"
            disabled={isLoading}
            className={`change-password__button ${
              isLoading ? 'change-password__button--loading' : ''
            }`}
          >
            {isLoading ? (
              <div className="change-password__spinner">
                <svg className="change-password__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="change-password__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="change-password__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating Password...
              </div>
            ) : (
              'Change Password'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
 
 
 