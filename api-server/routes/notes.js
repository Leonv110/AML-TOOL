const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/notes/customer/:customerId — fetch notes for customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notes WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/notes — save a note
router.post('/', authenticateToken, async (req, res) => {
  try {
    const note = req.body;
    await pool.query(
      'INSERT INTO notes (customer_id, content, analyst_name, created_by) VALUES ($1, $2, $3, $4)',
      [note.customer_id, note.content, note.analyst_name, note.created_by || req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Save note error:', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

module.exports = router;
