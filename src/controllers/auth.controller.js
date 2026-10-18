const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Basic email regex for backend validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new user
 */
async function register(req, res, next) {
  try {
    let { name, email, password } = req.body;

    name = typeof name === 'string' ? name.trim() : '';
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';

    // Validations
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be between 2 and 100 characters.'
      });
    }

    if (!email || !EMAIL_REGEX.test(email) || email.length > 190) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if user already exists
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Hash password securely with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const newUser = {
      id: result.insertId,
      name,
      email
    };

    // Automatically authenticate the session
    req.session.user = newUser;

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user: newUser }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log in an existing user
 */
async function login(req, res, next) {
  try {
    let { email, password } = req.body;

    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are both required.'
      });
    }

    // Fetch user by email
    const [users] = await db.execute(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = users[0];

    // Verify password hash
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email
    };

    // Store user in session
    req.session.user = sessionUser;

    res.json({
      success: true,
      message: 'Logged in successfully.',
      data: { user: sessionUser }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Log out the current user
 */
function logout(req, res, next) {
  if (!req.session) {
    return res.json({ success: true, message: 'Logged out successfully.' });
  }

  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  });
}

/**
 * Get the currently authenticated user's profile
 */
async function getMe(req, res, next) {
  try {
    if (!req.session || !req.session.user) {
      return res.json({
        success: true,
        data: { user: null }
      });
    }

    // Refresh from DB to verify user still exists
    const [users] = await db.execute(
      'SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1',
      [req.session.user.id]
    );

    if (users.length === 0) {
      req.session.destroy();
      return res.json({
        success: true,
        data: { user: null }
      });
    }

    res.json({
      success: true,
      data: { user: users[0] }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe
};
