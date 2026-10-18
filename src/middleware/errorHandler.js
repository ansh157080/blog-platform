/**
 * 404 Not Found handler for API routes
 */
function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API endpoint ${req.method} ${req.path} not found.`
    });
  }
  next();
}

/**
 * Global application error handler
 */
function globalErrorHandler(err, req, res, next) {
  console.error('[Unhandled Error]', err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
