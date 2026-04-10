const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/kpis — aggregated dashboard stats (user-scoped)
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [custRes, alertRes, sarRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM customers WHERE (uploaded_by = $1 OR uploaded_by IS NULL)', [userId]),
      pool.query("SELECT COUNT(*) as count FROM alerts WHERE status = 'open' AND (uploaded_by = $1 OR uploaded_by IS NULL)", [userId]),
      pool.query("SELECT COUNT(*) as count FROM investigations WHERE status = 'draft_sar'"),
    ]);

    res.json({
      totalCustomers: parseInt(custRes.rows[0].count, 10),
      openAlerts: parseInt(alertRes.rows[0].count, 10),
      openSAR: parseInt(sarRes.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Fetch KPIs error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard KPIs' });
  }
});

// GET /api/dashboard/analyst-stats — analyst performance data
router.get('/analyst-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [alertsRes, investigationsRes] = await Promise.all([
      pool.query("SELECT assigned_to, status, created_at FROM alerts WHERE status != 'open' AND (uploaded_by = $1 OR uploaded_by IS NULL)", [userId]),
      pool.query('SELECT assigned_to, status FROM investigations'),
    ]);

    res.json({
      alerts: alertsRes.rows,
      investigations: investigationsRes.rows,
    });
  } catch (err) {
    console.error('Fetch analyst stats error:', err);
    res.status(500).json({ error: 'Failed to fetch analyst stats' });
  }
});

// GET /api/dashboard/counts — individual table counts (user-scoped)
router.get('/counts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [custRes, highRiskRes, alertRes, sarRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM customers WHERE (uploaded_by = $1 OR uploaded_by IS NULL)', [userId]),
      pool.query("SELECT COUNT(*) as count FROM customers WHERE pep_flag = true AND (uploaded_by = $1 OR uploaded_by IS NULL)", [userId]),
      pool.query("SELECT COUNT(*) as count FROM alerts WHERE status = 'open' AND (uploaded_by = $1 OR uploaded_by IS NULL)", [userId]),
      pool.query("SELECT COUNT(*) as count FROM investigations WHERE status = 'draft_sar'"),
    ]);

    res.json({
      totalCustomers: parseInt(custRes.rows[0].count, 10),
      highRisk: parseInt(highRiskRes.rows[0].count, 10),
      openAlerts: parseInt(alertRes.rows[0].count, 10),
      openSAR: parseInt(sarRes.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Fetch counts error:', err);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

module.exports = router;
