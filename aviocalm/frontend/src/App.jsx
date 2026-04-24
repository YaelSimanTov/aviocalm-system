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
import CreateTherapistPage from "./pages/create-therapist-page";
import TherapistList from "./components/therapist-list/therapistlist";



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
      return <Navigate to="/admin/global-stats" replace />;
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
      return <Navigate to="/admin/global-stats" replace />;
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
          <Route path="/create-therapist" element={
            <ProtectedRoute>
              <CreateTherapistPage />
            </ProtectedRoute>
          } />
          {/* Protected Routes */}
          <Route path="/patients" element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
            <Route index element={<PatientList />} />
            <Route path="add" element={<AddPatientForm />} />
            <Route path=":id" element={<PatientProfile />} />
          </Route>

          <Route path="/admin/global-stats" element={
            <ProtectedRoute requiredRole="Owner">
              <AuthenticatedLayout />
            </ProtectedRoute>
          }>
            <Route index element={<GlobalStats />} />
          </Route>
          <Route path="/admin/therapists" element={
           <ProtectedRoute requiredRole="Owner">
            <AuthenticatedLayout />
          </ProtectedRoute>
          }>
  <Route index element={<TherapistList />} />
</Route>
          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
