const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports — fetch report history
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { report_type, limit = 100 } = req.query;

    let query = 'SELECT * FROM reports';
    const params = [];

    if (report_type) {
      params.push(report_type);
      query += ` WHERE report_type = $${params.length}`;
    }

    query += ' ORDER BY generated_at DESC';
    params.push(parseInt(limit, 10));
    query += ` LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST /api/reports — save report metadata after generation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { report_type, parameters, row_count, title, case_id, customer_id } = req.body;

    if (!report_type) {
      return res.status(400).json({ error: 'report_type is required' });
    }

    const result = await pool.query(
      `INSERT INTO reports (report_type, generated_by, parameters, row_count, title, case_id, customer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        report_type,
        req.user?.id || null,
        parameters ? JSON.stringify(parameters) : null,
        row_count || 0,
        title || `${report_type} Report`,
        case_id || null,
        customer_id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Save report error:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// GET /api/reports/ctr-data — query transactions for CTR
router.get('/ctr-data', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, threshold = 1000000, transaction_type } = req.query;

    let query = `
      SELECT t.*, c.name as customer_name, c.account_number
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      WHERE CAST(t.amount AS NUMERIC) >= $1
    `;
    const params = [parseFloat(threshold)];

    if (start_date) {
      params.push(start_date);
      query += ` AND t.transaction_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND t.transaction_date <= $${params.length}`;
    }
    if (transaction_type && transaction_type !== 'All') {
      params.push(transaction_type);
      query += ` AND LOWER(t.transaction_type) = LOWER($${params.length})`;
    }

    query += ' ORDER BY t.transaction_date DESC LIMIT 5000';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('CTR data error:', err);
    res.status(500).json({ error: 'Failed to fetch CTR data' });
  }
});

// GET /api/reports/risk-data — query customers with computed risk tiers
router.get('/risk-data', authenticateToken, async (req, res) => {
  try {
    const { risk_tier } = req.query;

    // Compute risk_tier dynamically since column doesn't exist in DB
    const result = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    
    const highRiskCountries = ['iran', 'north korea', 'myanmar', 'syria', 'libya', 'somalia', 'yemen'];
    const medRiskCountries = ['nigeria', 'pakistan', 'afghanistan', 'uae', 'russia', 'china'];

    const customers = result.rows.map(c => {
      let tier = 'LOW';
      if (c.pep_flag === true || c.pep_flag === 'true') tier = 'HIGH';
      else if (highRiskCountries.includes((c.country || '').toLowerCase())) tier = 'HIGH';
      else if (medRiskCountries.includes((c.country || '').toLowerCase())) tier = 'MEDIUM';
      else if (parseFloat(c.income || 0) > 5000000) tier = 'MEDIUM';
      return { ...c, risk_tier: tier };
    });

    if (risk_tier && risk_tier !== 'ALL') {
      const filtered = customers.filter(c => c.risk_tier === risk_tier.toUpperCase());
      return res.json(filtered);
    }

    res.json(customers);
  } catch (err) {
    console.error('Risk data error:', err);
    res.status(500).json({ error: 'Failed to fetch risk data' });
  }
});

// GET /api/reports/schedules — get report schedules
router.get('/schedules', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM report_schedules ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    // Table may not exist yet — return empty
    res.json([]);
  }
});

// POST /api/reports/schedules — create/update schedule
router.post('/schedules', authenticateToken, async (req, res) => {
  try {
    const { report_type, frequency, parameters, recipient_email, is_active } = req.body;

    const result = await pool.query(
      `INSERT INTO report_schedules (report_type, frequency, parameters, recipient_email, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        report_type,
        frequency || 'weekly',
        parameters ? JSON.stringify(parameters) : null,
        recipient_email || null,
        is_active !== false,
        req.user?.id || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Save schedule error:', err);
    res.status(500).json({ error: 'Failed to save schedule' });
  }
});

// DELETE /api/reports/schedules/:id
router.delete('/schedules/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM report_schedules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

module.exports = router;
