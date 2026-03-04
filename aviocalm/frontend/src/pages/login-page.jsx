import React, { useState } from 'react';
import { useAuth } from '../context/auth-context';
import { LoginForm } from '../components/login-form/login-form';

export const LoginPage = () => {
  const { login, error, isLoading } = useAuth();
  const [loginError, setLoginError] = useState('');

  const handleLogin = async (username, password) => {
    setLoginError('');
    const result = await login(username, password);
    
    if (!result.success) {
      setLoginError(result.error);
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
            Welcome to AvioCalm
          </h2>
          <p className="text-violet-200 text-sm">
            Therapeutic Platform for Aerophobia Treatment
          </p>
        </div>
        
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <LoginForm 
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={loginError || error}
          />
        </div>
      </div>
    </div>
  );
};
