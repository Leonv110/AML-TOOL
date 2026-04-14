const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}
const TOKEN_EXPIRY = '24h';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, role = 'student' } = req.body;

    if (!email || !password) {
      client.release();
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Disable open signup as requested
    client.release();
    return res.status(403).json({ error: 'Signup is currently restricted. Please contact your administrator.' });

    // The rest of the function will be blocked
    /*
    if (password.length < 6) {
      client.release();
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: 'User already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user
    const userResult = await client.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, password_hash]
    );
    const user = userResult.rows[0];

    // Insert profile
    await client.query(
      'INSERT INTO profiles (id, email, role) VALUES ($1, $2, $3)',
      [user.id, email, role]
    );
    client.release();

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.status(201).json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      role,
      token,
    */
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }
    const user = userResult.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    // Fetch role from profiles
    const profileResult = await pool.query('SELECT role FROM profiles WHERE id = $1', [user.id]);
    const role = profileResult.rows[0]?.role || null;

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      role,
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});

// NOTE: seed-admin endpoint removed — use seed-admin.js CLI script instead
// Run: node seed-admin.js (requires DATABASE_URL and JWT_SECRET in .env)

// GET /api/auth/me — get current user from token
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profileResult = await pool.query('SELECT role FROM profiles WHERE id = $1', [req.user.id]);
    const role = profileResult.rows[0]?.role || null;

    res.json({
      user: userResult.rows[0],
      role,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
