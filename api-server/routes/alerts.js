const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts — fetch alerts with optional status filter
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM alerts';
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/customer/:customerId — alerts for a customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alerts WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch customer alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/count/:ruleName — count alerts by rule
router.get('/count/:ruleName', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM alerts WHERE rule_triggered = $1',
      [req.params.ruleName]
    );
    res.json({ count: parseInt(rows[0].count, 10) });
  } catch (err) {
    console.error('Count alerts error:', err);
    res.status(500).json({ error: 'Failed to count alerts' });
  }
});

// GET /api/alerts/rule-summary — get rule_triggered values for all alerts
router.get('/rule-summary', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT rule_triggered FROM alerts');
    res.json(rows);
  } catch (err) {
    console.error('Fetch rule summary error:', err);
    res.status(500).json({ error: 'Failed to fetch rule summary' });
  }
});

// PATCH /api/alerts/:alertId/status — update alert status
router.patch('/:alertId/status', authenticateToken, async (req, res) => {
  try {
    const { status, case_id } = req.body;
    let query = 'UPDATE alerts SET status = $1';
    const params = [status];
    let idx = 2;

    if (case_id) {
      query += `, case_id = $${idx++}`;
      params.push(case_id);
    }

    query += ` WHERE alert_id = $${idx}`;
    params.push(req.params.alertId);

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Update alert status error:', err);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// POST /api/alerts — insert alerts (batch)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const alerts = Array.isArray(req.body) ? req.body : [req.body];
    let inserted = 0;

    for (const a of alerts) {
      await pool.query(
        `INSERT INTO alerts (alert_id, customer_id, customer_name, risk_level, rule_triggered, status, transaction_id, amount, country, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (alert_id) DO NOTHING`,
        [a.alert_id, a.customer_id, a.customer_name, a.risk_level, a.rule_triggered, a.status || 'open', a.transaction_id, a.amount, a.country, a.created_at || new Date().toISOString()]
      );
      inserted++;
    }

    res.json({ inserted });
  } catch (err) {
    console.error('Insert alerts error:', err);
    res.status(500).json({ error: 'Failed to insert alerts' });
  }
});

module.exports = router;
