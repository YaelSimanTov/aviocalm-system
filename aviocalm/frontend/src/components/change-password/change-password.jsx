import React, { useState, useEffect } from 'react';
import './change-password.css';

export const ChangePasswordForm = ({ onSubmit, isLoading, error, success, fieldErrors }) => {
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [validationErrors, setValidationErrors] = useState({});

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
    
    if (!/[0-9]/.test(password) || !/[!@#$%]/.test(password)) {
      errors.special = 'Must include a number and a special character.';
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
          <input
            id="oldPassword"
            name="oldPassword"
            type="password"
            autoComplete="current-password"
            required
            className={`change-password__input ${
              validationErrors.oldPassword || fieldErrors.oldPassword ? 'change-password__input--error' : ''
            }`}
            placeholder="Enter your current password"
            value={formData.oldPassword}
            onChange={handleChange}
          />
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
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            className={`change-password__input ${
              validationErrors.newPassword ? 'change-password__input--error' : ''
            }`}
            placeholder="Enter your new password"
            value={formData.newPassword}
            onChange={handleChange}
          />
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
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className={`change-password__input ${
              validationErrors.confirmPassword ? 'change-password__input--error' : ''
            }`}
            placeholder="Confirm your new password"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
          {(validationErrors.confirmPassword || fieldErrors.confirmPassword) && (
            <p className="change-password__validation-error">
              {validationErrors.confirmPassword || fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Password Requirements */}
        <div className="change-password__requirements">
          <h4 className="change-password__requirements-title">Password Requirements:</h4>
          <ul className="change-password__requirements-list">
            <li className="change-password__requirement">At least 8 characters long</li>
            <li className="change-password__requirement">Contains uppercase letter (A-Z)</li>
            <li className="change-password__requirement">Contains lowercase letter (a-z)</li>
            <li className="change-password__requirement">Contains number and special character (!@#$%)</li>
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
 
 