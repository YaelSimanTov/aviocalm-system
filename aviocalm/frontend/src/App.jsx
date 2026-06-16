import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/auth-context';
import { LoginPage } from './pages/login-page';
import { ChangePasswordPage } from './pages/change-password-page';
import { PatientList } from './pages/patient-list';
import { AuthenticatedLayout } from './layouts/authenticated-layout';
import './index.css';
import AddPatientForm from './components/add-patient-form/add-patient-form';
import PatientProfile from './components/patient-profile/patient-profile';
import { SessionDetails } from './components/session-details/session-details';
import TeamManagement from './components/admin/team-management';
import InventoryDashboard from './components/admin/inventory-dashboard';
import CreateTherapistPage from './pages/create-therapist-page';

// Placeholder components for routes that don't exist yet
const GlobalStats = () => <div className="p-8"><h1 className="text-2xl font-bold">Global Stats</h1><p>Coming soon...</p></div>;
const NotFound = () => <div className="p-8"><h1 className="text-2xl font-bold text-red-600">404 - Page Not Found</h1></div>;

function PublicRoute({ children }) {
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

  // If authenticated, redirect to appropriate dashboard
  if (isAuthenticated && !user?.isFirstLogin) {
    if (user?.role === 'Owner') {
      return <Navigate to="/admin/team-management" replace />;
    } else if (user?.role === 'Therapist') {
      return <Navigate to="/patients" replace />;
    }
  }

  // If authenticated but first login, redirect to change-password
  if (isAuthenticated && user?.isFirstLogin) {
    return <Navigate to="/change-password" replace />;
  }

  // If not authenticated, show public route
  return children;
}

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

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

  // Check first login - but allow access to change-password page
  if (user?.isFirstLogin && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
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
  if (isAuthenticated && !user?.isFirstLogin) {
    if (user?.role === 'Owner') {
      return <Navigate to="/admin/team-management" replace />;
    } else if (user?.role === 'Therapist') {
      return <Navigate to="/patients" replace />;
    }
  }

  // If authenticated but first login, redirect to change-password
  if (isAuthenticated && user?.isFirstLogin) {
    return <Navigate to="/change-password" replace />;
  }

  // If not authenticated, show login page
  return <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          <Route path="/change-password" element={
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
            <Route path="add" element={<AddPatientForm />} />
            <Route path=":id" element={<PatientProfile />} />
            <Route path=":patientId/sessions/:sessionId" element={<SessionDetails />} />
          </Route>

          
          <Route path="/admin/team-management" element={
            <ProtectedRoute requiredRole="Owner">
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
            <Route index element={<TeamManagement />} />
          </Route>
          <Route path="/admin/create-therapist" element={
            <ProtectedRoute requiredRole="Owner">
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
           <Route index element={<CreateTherapistPage />} />
            </Route>
          <Route path="/admin/hardware-inventory" element={
            <ProtectedRoute requiredRole="Owner">
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
            <Route index element={<InventoryDashboard />} />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
