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
  
  // Default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  // Only add auth token if not a login request and token exists
  const token = localStorage.getItem('aviocalm_token');
  if (token && !endpoint.includes('/auth/login')) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  
  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };
  
  // If this is a login request, explicitly remove any Authorization header
  if (endpoint.includes('/auth/login')) {
    delete headers.Authorization;
  }
  
  // Merge options
  const config = {
    ...options,
    headers,
  };
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    // Handle different response scenarios
    if (!response.ok) {
      // Return error in standard format
      return {
        success: false,
        error: data.error || `HTTP error! status: ${response.status}`,
        data: null,
      };
    }
    
    // Ensure response follows our standard format
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
  // Authentication
  login: (username, password) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  
  // Owner endpoints
  getOwnerDashboard: () => {
    return apiRequest('/owner/dashboard');
  },
  
  // Generic GET request
  get: (endpoint) => {
    return apiRequest(endpoint, { method: 'GET' });
  },
  
  // Generic POST request
  post: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Generic PUT request
  put: (endpoint, data) => {
    return apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  // Generic DELETE request
  delete: (endpoint) => {
    return apiRequest(endpoint, { method: 'DELETE' });
  },
};

export default api;
