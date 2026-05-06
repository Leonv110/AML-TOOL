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
// FIXED: highRisk now uses risk_level = 'HIGH' or 'CRITICAL' from alerts, not pep_flag
router.get('/counts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [custRes, txnRes, highRiskRes, alertRes, falsePositiveRes] = await Promise.all([
      pool.query(
        'SELECT COUNT(*) as count FROM customers WHERE (uploaded_by = $1 OR uploaded_by IS NULL)',
        [userId]
      ),
      pool.query(
        'SELECT COUNT(*) as count FROM transactions WHERE (uploaded_by = $1 OR uploaded_by IS NULL)',
        [userId]
      ),
      // HIGH RISK = dynamically computed from transaction scores + screening (same formula as customer directory)
      pool.query(
        `WITH txn_stats AS (
          SELECT customer_id,
            COALESCE(MAX(CAST(risk_score AS numeric)), 0) as max_score,
            COUNT(*) as flagged_count
          FROM transactions
          WHERE flagged = true AND (uploaded_by = $1 OR uploaded_by IS NULL)
          GROUP BY customer_id
        ),
        customer_scores AS (
          SELECT c.customer_id,
            LEAST(
              LEAST(ROUND(COALESCE(ts.max_score, 0) / 100.0 * 35), 35) +
              CASE
                WHEN COALESCE(ts.flagged_count, 0) >= 10 THEN 15
                WHEN COALESCE(ts.flagged_count, 0) >= 5 THEN 10
                WHEN COALESCE(ts.flagged_count, 0) >= 2 THEN 6
                WHEN COALESCE(ts.flagged_count, 0) >= 1 THEN 3
                ELSE 0
              END, 50
            ) +
            LEAST(
              CASE WHEN c.pep_flag = true THEN 30 ELSE 0 END +
              CASE WHEN LOWER(c.occupation) LIKE '%hni%' THEN 15 ELSE 0 END +
              CASE WHEN LOWER(c.occupation) LIKE '%crypto%' OR LOWER(c.occupation) LIKE '%exchange%' THEN 25 ELSE 0 END,
              50
            ) as total_risk
          FROM customers c
          LEFT JOIN txn_stats ts ON ts.customer_id = c.customer_id
          WHERE (c.uploaded_by = $1 OR c.uploaded_by IS NULL)
        )
        SELECT COUNT(*) as count FROM customer_scores WHERE total_risk >= 35`,
        [userId]
      ),
      pool.query(
        "SELECT COUNT(*) as count FROM alerts WHERE status = 'open' AND (uploaded_by = $1 OR uploaded_by IS NULL)",
        [userId]
      ),
      // False positives = alerts closed as false positive
      pool.query(
        "SELECT COUNT(*) as count FROM alerts WHERE status = 'closed_false_positive' AND (uploaded_by = $1 OR uploaded_by IS NULL)",
        [userId]
      ),
    ]);

    res.json({
      totalCustomers: parseInt(custRes.rows[0].count, 10),
      totalTransactions: parseInt(txnRes.rows[0].count, 10),
      highRisk: parseInt(highRiskRes.rows[0].count, 10),
      openAlerts: parseInt(alertRes.rows[0].count, 10),
      falsePositives: parseInt(falsePositiveRes.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Fetch counts error:', err);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

// GET /api/dashboard/trend — monthly flagged transaction trend (last 12 months)
router.get('/trend', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', transaction_date), 'Mon') AS month,
         DATE_TRUNC('month', transaction_date) AS month_date,
         COUNT(*) FILTER (WHERE flagged = true) AS fraud_cases,
         COUNT(*) AS total_transactions
       FROM transactions
       WHERE transaction_date >= NOW() - INTERVAL '12 months'
         AND transaction_date IS NOT NULL
         AND (uploaded_by = $1 OR uploaded_by IS NULL)
       GROUP BY month_date, month
       ORDER BY month_date ASC`,
      [userId]
    );
    res.json(rows.map(r => ({
      month: r.month,
      fraudCases: parseInt(r.fraud_cases, 10),
      highRiskAlerts: parseInt(r.total_transactions, 10),
    })));
  } catch (err) {
    console.error('Fetch trend error:', err);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// GET /api/dashboard/risk-breakdown — customer risk level distribution (dynamic)
router.get('/risk-breakdown', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `WITH txn_stats AS (
        SELECT customer_id,
          COALESCE(MAX(CAST(risk_score AS numeric)), 0) as max_score,
          COUNT(*) as flagged_count
        FROM transactions
        WHERE flagged = true AND (uploaded_by = $1 OR uploaded_by IS NULL)
        GROUP BY customer_id
      ),
      customer_scores AS (
        SELECT c.customer_id,
          LEAST(
            LEAST(ROUND(COALESCE(ts.max_score, 0) / 100.0 * 35), 35) +
            CASE
              WHEN COALESCE(ts.flagged_count, 0) >= 10 THEN 15
              WHEN COALESCE(ts.flagged_count, 0) >= 5 THEN 10
              WHEN COALESCE(ts.flagged_count, 0) >= 2 THEN 6
              WHEN COALESCE(ts.flagged_count, 0) >= 1 THEN 3
              ELSE 0
            END, 50
          ) +
          LEAST(
            CASE WHEN c.pep_flag = true THEN 30 ELSE 0 END +
            CASE WHEN LOWER(c.occupation) LIKE '%hni%' THEN 15 ELSE 0 END +
            CASE WHEN LOWER(c.occupation) LIKE '%crypto%' OR LOWER(c.occupation) LIKE '%exchange%' THEN 25 ELSE 0 END,
            50
          ) as total_risk
        FROM customers c
        LEFT JOIN txn_stats ts ON ts.customer_id = c.customer_id
        WHERE (c.uploaded_by = $1 OR c.uploaded_by IS NULL)
      )
      SELECT
        COUNT(*) FILTER (WHERE total_risk >= 50) as critical,
        COUNT(*) FILTER (WHERE total_risk >= 35 AND total_risk < 50) as high,
        COUNT(*) FILTER (WHERE total_risk >= 25 AND total_risk < 35) as medium,
        COUNT(*) FILTER (WHERE total_risk < 25) as low
      FROM customer_scores`,
      [userId]
    );

    const r = rows[0] || {};
    res.json([
      { name: 'Critical', value: parseInt(r.critical || 0, 10), color: '#dc2626' },
      { name: 'High Risk', value: parseInt(r.high || 0, 10), color: '#ef4444' },
      { name: 'Medium Risk', value: parseInt(r.medium || 0, 10), color: '#f59e0b' },
      { name: 'Low Risk', value: parseInt(r.low || 0, 10), color: '#22c55e' },
    ]);
  } catch (err) {
    console.error('Fetch risk breakdown error:', err);
    res.status(500).json({ error: 'Failed to fetch risk breakdown' });
  }
});

// GET /api/dashboard/time-of-day — fraud by time of day
router.get('/time-of-day', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT EXTRACT(HOUR FROM transaction_date AT TIME ZONE 'Asia/Kolkata') AS hour_ist, COUNT(*) as count
       FROM transactions
       WHERE flagged = true AND transaction_date IS NOT NULL
         AND (uploaded_by = $1 OR uploaded_by IS NULL)
       GROUP BY hour_ist`,
      [userId]
    );

    let morning = 0, afternoon = 0, night = 0;
    rows.forEach(r => {
      const h = parseInt(r.hour_ist, 10);
      const c = parseInt(r.count, 10);
      if (h >= 6 && h < 12) morning += c;
      else if (h >= 12 && h < 20) afternoon += c;
      else night += c;
    });

    res.json([
      { name: 'Morning', value: morning, color: '#f59e0b' },
      { name: 'Afternoon', value: afternoon, color: '#0ea5e9' },
      { name: 'Night', value: night, color: '#8b5cf6' },
    ]);
  } catch (err) {
    console.error('Fetch time of day error:', err);
    res.status(500).json({ error: 'Failed to fetch time-of-day data' });
  }
});

// GET /api/dashboard/top-locations — top flagged transaction locations
router.get('/top-locations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await pool.query(
      `SELECT country, COUNT(*) as count
       FROM transactions
       WHERE country IS NOT NULL AND country != ''
         AND flagged = true
         AND (uploaded_by = $1 OR uploaded_by IS NULL)
       GROUP BY country
       ORDER BY count DESC
       LIMIT 6`,
      [userId]
    );
    res.json(rows.map(r => ({ country: r.country, count: parseInt(r.count, 10) })));
  } catch (err) {
    console.error('Fetch top locations error:', err);
    res.status(500).json({ error: 'Failed to fetch top locations' });
  }
});

module.exports = router;
