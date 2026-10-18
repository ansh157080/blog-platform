const crypto = require('crypto');

/**
 * Ensure every session has a cryptographically secure CSRF token
 */
function ensureCsrfToken(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  next();
}

/**
 * Verify CSRF token on state-changing requests
 */
function verifyCsrfToken(req, res, next) {
  // Safe HTTP methods do not change state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt public auth endpoints where user doesn't have an active authenticated session yet
  const exemptPaths = ['/api/auth/login', '/api/auth/register'];
  if (exemptPaths.includes(req.path)) {
    return next();
  }

  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromBody = req.body && req.body._csrf;
  const clientToken = tokenFromHeader || tokenFromBody;
  const sessionToken = req.session && req.session.csrfToken;

  if (!sessionToken || !clientToken || clientToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token validation failed. Please refresh the page and try again.'
    });
  }

  next();
}

module.exports = {
  ensureCsrfToken,
  verifyCsrfToken
};
