const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/rules — fetch all rules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM rules ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch rules error:', err);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// PATCH /api/rules/:id/status — toggle rule status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      'UPDATE rules SET status = $1 WHERE id = $2',
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle rule status error:', err);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

module.exports = router;
