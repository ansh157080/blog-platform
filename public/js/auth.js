/**
 * Authentication module
 */

let currentUser = null;

function getCurrentUser() {
  return currentUser;
}

function isAuthenticated() {
  return !!currentUser;
}

/**
 * Check existing authentication session on load
 */
async function checkAuthStatus() {
  try {
    const res = await window.api.get('/api/auth/me');
    if (res.success && res.data && res.data.user) {
      currentUser = res.data.user;
    } else {
      currentUser = null;
    }
  } catch (err) {
    currentUser = null;
  }
  dispatchAuthChange();
  return currentUser;
}

/**
 * Log in with email and password
 */
async function login(email, password) {
  const res = await window.api.post('/api/auth/login', { email, password });
  if (res.success && res.data && res.data.user) {
    currentUser = res.data.user;
    dispatchAuthChange();
    // Refresh CSRF token for this new session
    await window.api.fetchCsrfToken();
  }
  return res;
}

/**
 * Register a new user
 */
async function register(name, email, password) {
  const res = await window.api.post('/api/auth/register', { name, email, password });
  if (res.success && res.data && res.data.user) {
    currentUser = res.data.user;
    dispatchAuthChange();
    // Refresh CSRF token
    await window.api.fetchCsrfToken();
  }
  return res;
}

/**
 * Log out
 */
async function logout() {
  try {
    await window.api.post('/api/auth/logout');
  } catch (err) {
    console.warn('Logout API warning:', err);
  } finally {
    currentUser = null;
    dispatchAuthChange();
    await window.api.fetchCsrfToken();
  }
}

/**
 * Notify application of authentication change
 */
function dispatchAuthChange() {
  window.dispatchEvent(new CustomEvent('authChange', { detail: { user: currentUser } }));
}

window.auth = {
  getCurrentUser,
  isAuthenticated,
  checkAuthStatus,
  login,
  register,
  logout
};
