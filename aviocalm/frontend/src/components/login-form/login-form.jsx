import React, { useState } from 'react';
import './login-form.css';

export const LoginForm = ({ onSubmit, isLoading, error }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData.username, formData.password);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {/* Error Display */}
      {error && (
        <div className="login-form__error">
          <div className="login-form__error-content">
            <h3 className="login-form__error-title">
              {error}
            </h3>
          </div>
        </div>
      )}
      
      <div className="login-form__input-group">
        {/* Username Field */}
        <div className="login-form__field">
          <label htmlFor="username" className="login-form__label">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            className={`login-form__input ${
              validationErrors.username ? 'login-form__input--error' : ''
            }`}
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
          />
          {validationErrors.username && (
            <p className="login-form__validation-error">{validationErrors.username}</p>
          )}
        </div>
        
        {/* Password Field */}
        <div className="login-form__field">
          <label htmlFor="password" className="login-form__label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={`login-form__input ${
              validationErrors.password ? 'login-form__input--error' : ''
            }`}
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />
          {validationErrors.password && (
            <p className="login-form__validation-error">{validationErrors.password}</p>
          )}
        </div>
      </div>

      <div className="login-form__submit">
        <button
          type="submit"
          disabled={isLoading}
          className={`login-form__button ${
            isLoading ? 'login-form__button--loading' : ''
          }`}
        >
          {isLoading ? (
            <div className="login-form__spinner">
              <svg className="login-form__spinner-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="login-form__spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="login-form__spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Signing in...
            </div>
          ) : (
            'Log In'
          )}
        </button>
        
        <div className="flex justify-center text-sm mt-4">
          <a href="/forgot-password" className="font-bold text-violet-600 hover:text-violet-400 transition-colors">
            Forgot your password? Reset it here
          </a>
        </div>
      </div>
    </form>
  );
};
