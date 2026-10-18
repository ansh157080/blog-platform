/**
 * Middleware to enforce authentication
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in to perform this action.'
    });
  }
  next();
}

/**
 * Optional authentication middleware: populates req.user if session exists, but doesn't block
 */
function optionalAuth(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
