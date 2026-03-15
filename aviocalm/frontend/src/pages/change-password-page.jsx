import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { ChangePasswordForm } from '../components/change-password/change-password';

export const ChangePasswordPage = () => {
  const { changePassword, logout, isLoading, isAuthenticated, user } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  // const handleChangePassword = async (oldPassword, newPassword) => {
  //   setError('');
  //   setSuccess(false);
  //   setFieldErrors({});
    
  //   const result = await changePassword(oldPassword, newPassword);
    
  //   if (result.success) {
  //     setSuccess(true);
  //     // Wait 2 seconds, then logout and redirect to login
  //     setTimeout(() => {
  //       logout(); // Clear all tokens and local storage
  //       navigate('/login');
  //     }, 2000);
  //   } else {
  //     // Handle field-specific errors
  //     if (result.field) {
  //       setFieldErrors({ [result.field]: result.message });
  //     } else {
  //       setError(result.error);
  //     }
  //   }
  // };
const handleChangePassword = async (oldPassword, newPassword) => {
    setError('');
    setSuccess(false);
    setFieldErrors({});
    
    const result = await changePassword(oldPassword, newPassword);
    
    if (result.success) {
      setSuccess(true);
      // Wait 2 seconds, then logout and redirect to login
      setTimeout(() => {
        logout(); // Clear all tokens and local storage
        navigate('/login');
      }, 2000);
    } else {
      // Handle field-specific errors
      if (result.field) {
        // התיקון: אנחנו מבקשים את result.error ולא את result.message
        setFieldErrors({ [result.field]: result.error });
      } else {
        setError(result.error);
      }
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-white shadow-2xl mb-8">
            {/* AvioCalm Logo */}
            <div className="text-violet-600 font-bold text-2xl">AC</div>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2">
            Change Your Password
          </h2>
          <p className="text-violet-200 text-sm">
            AvioCalm - Therapeutic Platform for Aerophobia Treatment
          </p>
        </div>
        
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <ChangePasswordForm 
            onSubmit={handleChangePassword}
            isLoading={isLoading}
            error={error}
            success={success}
            fieldErrors={fieldErrors}
          />
        </div>
      </div>
    </div>
  );
};
