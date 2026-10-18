/**
 * API client module for REST communication with Express backend
 */

let cachedCsrfToken = null;

/**
 * Fetch and store CSRF token from the server
 */
async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await res.json();
    if (data.success && data.csrfToken) {
      cachedCsrfToken = data.csrfToken;
    }
  } catch (err) {
    console.warn('[API] Could not fetch CSRF token:', err);
  }
  return cachedCsrfToken;
}

/**
 * Unified request helper
 */
async function apiRequest(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};

  // For state-changing requests, ensure CSRF token is attached
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (!cachedCsrfToken) {
      await fetchCsrfToken();
    }
    if (cachedCsrfToken) {
      headers['x-csrf-token'] = cachedCsrfToken;
    }
  }

  // If body is NOT FormData, set JSON Content-Type
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  const fetchOptions = {
    ...options,
    method,
    headers,
    credentials: 'include'
  };

  const response = await fetch(endpoint, fetchOptions);
  
  let jsonResult;
  try {
    jsonResult = await response.json();
  } catch (e) {
    jsonResult = { success: false, message: 'Invalid response from server' };
  }

  if (!response.ok) {
    const errorMessage = jsonResult.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = jsonResult;
    throw error;
  }

  return jsonResult;
}

window.api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, body) => apiRequest(url, { method: 'POST', body }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body }),
  delete: (url) => apiRequest(url, { method: 'DELETE' }),
  fetchCsrfToken
};
