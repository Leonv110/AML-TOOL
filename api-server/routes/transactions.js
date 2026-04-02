const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions — fetch all with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, minAmount, maxAmount, country, rule } = req.query;
    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let idx = 1;

    if (startDate) { query += ` AND transaction_date >= $${idx++}`; params.push(startDate); }
    if (endDate) { query += ` AND transaction_date <= $${idx++}`; params.push(endDate); }
    if (minAmount) { query += ` AND amount >= $${idx++}`; params.push(parseFloat(minAmount)); }
    if (maxAmount) { query += ` AND amount <= $${idx++}`; params.push(parseFloat(maxAmount)); }
    if (country) { query += ` AND country = $${idx++}`; params.push(country); }
    if (rule) { query += ` AND rule_triggered ILIKE $${idx++}`; params.push(`%${rule}%`); }

    query += ' ORDER BY transaction_date DESC LIMIT 50';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/transactions/customer/:customerId — transactions for a customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE customer_id = $1 ORDER BY transaction_date DESC LIMIT 50',
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch customer transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions — insert transactions (batch)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const transactions = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Array of transactions required' });
    }

    let inserted = 0;
    // Batch insert in chunks of 100
    for (let i = 0; i < transactions.length; i += 100) {
      const chunk = transactions.slice(i, i + 100);

      for (const t of chunk) {
        await pool.query(
          `INSERT INTO transactions (
            transaction_id, customer_id, account_number, amount, transaction_date,
            transaction_type, country, country_risk_level, is_new_device,
            degree_centrality, path_length_hops, balance_before, balance_after,
            days_since_last_transaction, user_transaction_count_7d, transaction_frequency_1hr,
            destination_id, flagged, flag_reason, rule_triggered, risk_score, batch_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
          )
          ON CONFLICT (transaction_id) DO NOTHING`,
          [
            t.transaction_id, t.customer_id, t.account_number, t.amount, t.transaction_date,
            t.transaction_type, t.country, t.country_risk_level, t.is_new_device,
            t.degree_centrality, t.path_length_hops, t.balance_before, t.balance_after,
            t.days_since_last_transaction, t.user_transaction_count_7d, t.transaction_frequency_1hr,
            t.destination_id, t.flagged, t.flag_reason, t.rule_triggered, t.risk_score, t.batch_id || null
          ]
        );
        inserted++;
      }
    }

    res.json({ inserted });
  } catch (err) {
    console.error('Insert transactions error:', err);
    res.status(500).json({ error: 'Failed to insert transactions' });
  }
});

// DELETE /api/transactions — delete all transactions
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM transactions');
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('Delete transactions error:', err);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

module.exports = router;
