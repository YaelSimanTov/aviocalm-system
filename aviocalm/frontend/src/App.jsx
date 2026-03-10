import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/auth-context';
import { LoginPage } from './pages/login-page';
import { ChangePasswordPage } from './pages/change-password-page';
import { PatientList } from './pages/patient-list';
import { AuthenticatedLayout } from './layouts/authenticated-layout';
import './index.css';

// Placeholder components for routes that don't exist yet
const GlobalStats = () => <div className="p-8"><h1 className="text-2xl font-bold">Global Stats</h1><p>Coming soon...</p></div>;
const NotFound = () => <div className="p-8"><h1 className="text-2xl font-bold text-red-600">404 - Page Not Found</h1></div>;

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check first login
  if (user?.is_first_login) {
    return <Navigate to="/reset-password" replace />;
  }

  // Check role-based access
  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Base route redirect logic
  if (isAuthenticated && !user?.is_first_login) {
    if (user?.role === 'Owner') {
      return <Navigate to="/admin/global-stats" replace />;
    } else if (user?.role === 'Therapist') {
      return <Navigate to="/patients" replace />;
    }
  }

  return <LoginPage />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          } />

          {/* Base Route - Handles role-based redirects */}
          <Route path="/" element={<AppContent />} />

          {/* Protected Routes */}
          <Route path="/patients" element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
            <Route index element={<PatientList />} />
          </Route>

          <Route path="/admin/global-stats" element={
            <ProtectedRoute requiredRole="Owner">
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
            <Route index element={<GlobalStats />} />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
