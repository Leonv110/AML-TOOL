const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const router = express.Router();

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * @swagger
 * /admin/health-check:
 *   get:
 *     summary: Check system health (API, DB, ML)
 *     tags: [Admin]
 *     security: []
 *     responses:
 *       200:
 *         description: Service health status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
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

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all registered users (admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Array of users with roles
 *       403:
 *         description: Admin access required
 */
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

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user account (admin only)
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCreateUser'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/users', authenticateToken, requireAdmin, validate(schemas.adminCreateUser), async (req, res) => {
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

/**
 * @swagger
 * /admin/users/{id}/role:
 *   patch:
 *     summary: Update a user's role (admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCreateUser'
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 */
router.patch('/users/:id/role', authenticateToken, requireAdmin, validate(schemas.adminUpdateRole), async (req, res) => {
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
