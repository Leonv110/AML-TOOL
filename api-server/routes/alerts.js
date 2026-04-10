const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts — fetch user's alerts with optional status filter
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.id;
    let query = 'SELECT * FROM alerts WHERE (uploaded_by = $1 OR uploaded_by IS NULL)';
    const params = [userId];
    let idx = 2;

    if (status && status !== 'all') {
      query += ` AND status = $${idx++}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT 200';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/customer/:customerId — alerts for a customer (user-scoped)
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alerts WHERE customer_id = $1 AND (uploaded_by = $2 OR uploaded_by IS NULL) ORDER BY created_at DESC',
      [req.params.customerId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch customer alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// GET /api/alerts/count/:ruleName — count alerts by rule (user-scoped)
router.get('/count/:ruleName', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM alerts WHERE rule_triggered = $1 AND (uploaded_by = $2 OR uploaded_by IS NULL)',
      [req.params.ruleName, req.user.id]
    );
    res.json({ count: parseInt(rows[0].count, 10) });
  } catch (err) {
    console.error('Count alerts error:', err);
    res.status(500).json({ error: 'Failed to count alerts' });
  }
});

// GET /api/alerts/rule-summary — get rule_triggered values (user-scoped)
router.get('/rule-summary', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT rule_triggered FROM alerts WHERE (uploaded_by = $1 OR uploaded_by IS NULL)',
      [req.user.id]
    );
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

    // Guard: prevent duplicate status change
    const existing = await pool.query(
      'SELECT status FROM alerts WHERE alert_id = $1 AND (uploaded_by = $2 OR uploaded_by IS NULL)',
      [req.params.alertId, req.user.id]
    );
    if (existing.rows.length > 0 && existing.rows[0].status === status) {
      return res.json({ success: true, message: 'Alert already in this status' });
    }

    let query = 'UPDATE alerts SET status = $1';
    const params = [status];
    let idx = 2;

    if (case_id) {
      query += `, case_id = $${idx++}`;
      params.push(case_id);
    }

    query += ` WHERE alert_id = $${idx++} AND (uploaded_by = $${idx++} OR uploaded_by IS NULL)`;
    params.push(req.params.alertId, req.user.id);

    await pool.query(query, params);
    res.json({ success: true });
  } catch (err) {
    console.error('Update alert status error:', err);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// POST /api/alerts — insert alerts (batch) with user ownership
router.post('/', authenticateToken, async (req, res) => {
  try {
    const alerts = Array.isArray(req.body) ? req.body : [req.body];
    const userId = req.user.id;
    if (alerts.length === 0) return res.json({ inserted: 0 });

    // Auto-create missing customers
    const uniqueCustomerIds = [...new Set(alerts.map(a => a.customer_id).filter(Boolean))];
    if (uniqueCustomerIds.length > 0) {
      const existingRes = await pool.query(
        'SELECT customer_id FROM customers WHERE customer_id = ANY($1)',
        [uniqueCustomerIds]
      );
      const existingIds = new Set(existingRes.rows.map(r => r.customer_id));
      const missingIds = uniqueCustomerIds.filter(id => !existingIds.has(id));

      if (missingIds.length > 0) {
        console.log(`Auto-creating ${missingIds.length} missing customers for alerts...`);
        const cVals = [];
        const cRows = [];
        let cIdx = 1;
        for (const cid of missingIds) {
          cRows.push(`($${cIdx++}, $${cIdx++}, $${cIdx++}, $${cIdx++}, $${cIdx++})`);
          cVals.push(cid, `ACC-${cid}`, `Customer ${cid}`, `customer ${cid}`, userId);
        }
        await pool.query(
          `INSERT INTO customers (customer_id, account_number, name, normalized_name, uploaded_by)
           VALUES ${cRows.join(', ')}
           ON CONFLICT (customer_id) DO NOTHING`,
          cVals
        );
      }
    }

    let inserted = 0;

    for (const a of alerts) {
      await pool.query(
        `INSERT INTO alerts (alert_id, customer_id, customer_name, risk_level, rule_triggered, status, transaction_id, amount, country, created_at, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (alert_id) DO NOTHING`,
        [a.alert_id, a.customer_id, a.customer_name, a.risk_level, a.rule_triggered, a.status || 'open', a.transaction_id, a.amount, a.country, a.created_at || new Date().toISOString(), userId]
      );
      inserted++;
    }

    res.json({ inserted });
  } catch (err) {
    console.error('Insert alerts error:', err);
    res.status(500).json({ error: 'Failed to insert alerts: ' + err.message });
  }
});

module.exports = router;
