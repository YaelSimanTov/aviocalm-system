// API utility for AvioCalm frontend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Generic API request function
export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  // Get auth token from localStorage
  const token = localStorage.getItem('aviocalm_token');
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  
  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };
  
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
