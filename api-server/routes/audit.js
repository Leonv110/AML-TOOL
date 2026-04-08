const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit — fetch audit logs (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { event_type, actor_id, limit = 200 } = req.query;

    let query = 'SELECT * FROM audit_logs';
    const conditions = [];
    const params = [];

    if (event_type) {
      params.push(event_type);
      conditions.push(`event_type = $${params.length}`);
    }
    if (actor_id) {
      params.push(actor_id);
      conditions.push(`actor_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC';
    params.push(parseInt(limit, 10));
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// POST /api/audit — insert a new audit log entry (INSERT ONLY — no update, no delete)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { event_type, actor_id, actor_role, entity_type, entity_id, metadata, timestamp, hmac_signature } = req.body;

    if (!event_type || !hmac_signature) {
      return res.status(400).json({ error: 'event_type and hmac_signature are required' });
    }

    const result = await pool.query(
      `INSERT INTO audit_logs (event_type, actor_id, actor_role, entity_type, entity_id, metadata, timestamp, hmac_signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [event_type, actor_id || null, actor_role || 'unknown', entity_type || null, entity_id || null, metadata ? JSON.stringify(metadata) : null, timestamp || new Date().toISOString(), hmac_signature]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Insert audit log error:', err);
    res.status(500).json({ error: 'Failed to insert audit log' });
  }
});

module.exports = router;
