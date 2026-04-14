const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /api/admin/health-check
router.get('/health-check', async (req, res) => {
  const health = {
    api: 'online',
    db: 'offline',
    ml: 'offline',
    timestamp: new Date().toISOString()
  };

  try {
    // Check DB
    await pool.query('SELECT 1');
    health.db = 'online';
  } catch (err) {
    console.error('Admin Check - DB Offline:', err.message);
  }

  try {
    // Check ML Backend (Python)
    const amlUrl = process.env.AML_BACKEND_URL || process.env.VITE_AML_BACKEND_URL || 'http://localhost:8000';
    const mlResponse = await axios.get(`${amlUrl}/health`, { timeout: 2000 });
    if (mlResponse.data && mlResponse.data.status === 'ok') {
      health.ml = 'online';
    }
  } catch (err) {
    console.error('Admin Check - ML Offline:', err.message);
  }

  res.json(health);
});

// ============================================================
// USER MANAGEMENT (Admin-only)
// ============================================================

// GET /api/admin/users — List all users with their roles
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.created_at, p.role
      FROM users u
      LEFT JOIN profiles p ON u.id = p.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users — Create a new user (admin-only)
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, role = 'student' } = req.body;

    if (!email || !password) {
      client.release();
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      client.release();
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const validRoles = ['student', 'investigator', 'admin', 'exam'];
    if (!validRoles.includes(role)) {
      client.release();
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Check if user already exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: 'A user with this email already exists' });
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

    // Insert profile with role
    await client.query(
      'INSERT INTO profiles (id, email, role) VALUES ($1, $2, $3)',
      [user.id, email, role]
    );

    client.release();

    res.status(201).json({
      id: user.id,
      email: user.email,
      role,
      created_at: user.created_at,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'Failed to create user. Please try again.' });
  }
});

// PATCH /api/admin/users/:id/role — Update a user's role
router.patch('/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['student', 'investigator', 'admin', 'exam'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    await pool.query('UPDATE profiles SET role = $1 WHERE id = $2', [role, id]);
    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
