const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/investigations — fetch all investigations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { assigned_to } = req.query;
    let query = 'SELECT * FROM investigations';
    const params = [];

    if (assigned_to) {
      query += ' WHERE assigned_to = $1';
      params.push(assigned_to);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch investigations error:', err);
    res.status(500).json({ error: 'Failed to fetch investigations' });
  }
});

// GET /api/investigations/case/:caseId — fetch by case_id
router.get('/case/:caseId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM investigations WHERE case_id = $1',
      [req.params.caseId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Fetch investigation error:', err);
    res.status(500).json({ error: 'Failed to fetch investigation' });
  }
});

// POST /api/investigations — create investigation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const inv = req.body;
    const { rows } = await pool.query(
      `INSERT INTO investigations (case_id, customer_id, customer_name, risk_level, alert_type, status, assigned_to, investigation_notes, decision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [inv.case_id, inv.customer_id, inv.customer_name, inv.risk_level, inv.alert_type, inv.status || 'open', inv.assigned_to, inv.investigation_notes, inv.decision]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create investigation error:', err);
    res.status(500).json({ error: 'Failed to create investigation' });
  }
});

// PATCH /api/investigations/:id — update investigation
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const setClauses = [];
    const params = [];
    let idx = 1;

    const allowedFields = ['status', 'investigation_notes', 'decision', 'assigned_to', 'customer_name', 'risk_level', 'alert_type'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${idx++}`);
        params.push(updates[field]);
      }
    }

    // Always update updated_at
    setClauses.push(`updated_at = $${idx++}`);
    params.push(new Date().toISOString());

    params.push(req.params.id);

    await pool.query(
      `UPDATE investigations SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update investigation error:', err);
    res.status(500).json({ error: 'Failed to update investigation' });
  }
});

module.exports = router;
