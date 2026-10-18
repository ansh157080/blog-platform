const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

// Initialize database pool
require('./config/db');

const { ensureCsrfToken, verifyCsrfToken } = require('./middleware/csrf');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const postRoutes = require('./routes/post.routes');
const commentRoutes = require('./routes/comment.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS if needed during development
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express session configuration
app.use(session({
  name: 'blog_session',
  secret: process.env.SESSION_SECRET || 'dev_session_secret_98234710293847',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// CSRF token generation and verification
app.use(ensureCsrfToken);
app.use(verifyCsrfToken);

// CSRF token route
app.get('/api/csrf-token', (req, res) => {
  res.json({
    success: true,
    csrfToken: req.session.csrfToken
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments', commentRoutes);

// SPA client-side fallback: serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 & Global Error Handlers
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Blog Platform Server is running!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`===============================================`);
  });
}

module.exports = app;
