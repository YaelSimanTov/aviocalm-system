// API utility for AvioCalm frontend

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Function to clear all auth-related headers and storage
export const clearAuthHeaders = () => {
  localStorage.removeItem('aviocalm_token');
  localStorage.removeItem('aviocalm_user');
  sessionStorage.removeItem('aviocalm_token');
  sessionStorage.removeItem('aviocalm_user');
  
  // Clear any cached headers
  if (typeof window !== 'undefined' && window.fetch) {
    delete window.defaultHeaders;
  }
};

// Generic API request function
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('aviocalm_token');
  if (token && !endpoint.includes('/auth/login')) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };
  if (endpoint.includes('/auth/login')) {
    delete headers.Authorization;
  }
  const config = {
    ...options,
    headers,
  };
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || `HTTP error! status: ${response.status}`,
        field: data.field || null,
        data: null,
      };
    }
    return {
      success: data.success !== undefined ? data.success : true,
      data: data.data !== undefined ? data.data : data,
      error: data.error || null,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
      data: null,
    };
  }
};

// Specific API methods
export const api = {
  login: (username, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  getOwnerDashboard: () => {
    return apiRequest('/owner/dashboard');
  },
  get: (endpoint) => {
    return apiRequest(endpoint, { method: 'GET' });
  },
  post: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  put: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  patch: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  delete: (endpoint) => {
    return apiRequest(endpoint, { method: 'DELETE' });
  },
  // Update a patient's status (Active | Inactive | Discharged)
  updatePatientStatus: (patientId, newStatus) => {
    return apiRequest(`/patients/${patientId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
  },
  // Mark all completed sessions for a patient as reviewed (clears unread indicators)
  markSessionsRead: (patientId) => {
    return apiRequest(`/patients/${patientId}/sessions/read`, {
      method: 'PUT',
    });
  },
  // Fetch all unread alerts (with patient details) for the Notification Center
  getUnreadAlerts: () => {
    return apiRequest('/alerts/unread', { method: 'GET' });
  },
  // Mark a single alert as read and decrement the unread badge
  markAlertRead: (alertId) => {
    return apiRequest(`/alerts/${alertId}/read`, { method: 'PATCH' });
  },
  // Fetch all alerts (read + unread) for a specific session — used by in-chart annotations
  getSessionAlerts: (sessionId) => {
    return apiRequest(`/patients/sessions/${sessionId}/alerts`, { method: 'GET' });
  },
};

export default api;
