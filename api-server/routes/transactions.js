const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions — fetch user's transactions with optional filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, minAmount, maxAmount, country, rule, page } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 500, 50000);
    const offset = ((parseInt(page) || 1) - 1) * limit;
    const userId = req.user.id;

    // Filter by uploaded_by = current user (data isolation)
    let query = 'SELECT * FROM transactions WHERE (uploaded_by = $1 OR uploaded_by IS NULL)';
    const params = [userId];
    let idx = 2;

    if (startDate) { query += ` AND transaction_date >= $${idx++}`; params.push(startDate); }
    if (endDate) { query += ` AND transaction_date <= $${idx++}`; params.push(endDate); }
    if (minAmount) { query += ` AND amount >= $${idx++}`; params.push(parseFloat(minAmount)); }
    if (maxAmount) { query += ` AND amount <= $${idx++}`; params.push(parseFloat(maxAmount)); }
    if (country) { query += ` AND country = $${idx++}`; params.push(country); }
    if (rule) { query += ` AND rule_triggered ILIKE $${idx++}`; params.push(`%${rule}%`); }

    query += ` ORDER BY transaction_date DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Fetch transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// PATCH /api/transactions/flag — batch update flagged status on user's transactions
router.patch('/flag', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Array of flag updates required' });
    }

    let updated = 0;
    const CHUNK_SIZE = 200;

    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const ids = chunk.map(u => u.transaction_id);
      
      let flagReasonCases = '';
      let ruleTriggeredCases = '';
      let riskScoreCases = '';
      const params = [];
      let pIdx = 1;

      for (const u of chunk) {
        flagReasonCases += ` WHEN transaction_id = $${pIdx++} THEN $${pIdx++}`;
        params.push(u.transaction_id, u.flag_reason || '');
        ruleTriggeredCases += ` WHEN transaction_id = $${pIdx++} THEN $${pIdx++}`;
        params.push(u.transaction_id, u.rule_triggered || '');
        riskScoreCases += ` WHEN transaction_id = $${pIdx++} THEN $${pIdx++}`;
        params.push(u.transaction_id, u.risk_score || 0);
      }

      const idPlaceholders = ids.map(() => `$${pIdx++}`);
      params.push(...ids);

      // Only update user's own transactions
      params.push(req.user.id);
      const userFilter = `$${pIdx++}`;

      const query = `
        UPDATE transactions SET
          flagged = TRUE,
          flag_reason = CASE ${flagReasonCases} END,
          rule_triggered = CASE ${ruleTriggeredCases} END,
          risk_score = CASE ${riskScoreCases} END
        WHERE transaction_id IN (${idPlaceholders.join(', ')})
          AND (uploaded_by = ${userFilter} OR uploaded_by IS NULL)
      `;

      const result = await pool.query(query, params);
      updated += result.rowCount;
    }

    res.json({ updated });
  } catch (err) {
    console.error('Flag transactions error:', err);
    res.status(500).json({ error: 'Failed to flag transactions: ' + err.message });
  }
});

// GET /api/transactions/customer/:customerId — transactions for a customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE customer_id = $1 AND (uploaded_by = $2 OR uploaded_by IS NULL) ORDER BY transaction_date DESC LIMIT 50',
      [req.params.customerId, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch customer transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions — insert transactions (batch) with user ownership
router.post('/', authenticateToken, async (req, res) => {
  try {
    const transactions = req.body;
    const userId = req.user.id;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Array of transactions required' });
    }

    // --- Step 1: Auto-create any missing customers with user ownership ---
    const uniqueCustomerIds = [...new Set(
      transactions.map(t => t.customer_id).filter(Boolean)
    )];

    if (uniqueCustomerIds.length > 0) {
      const existingRes = await pool.query(
        'SELECT customer_id FROM customers WHERE customer_id = ANY($1) AND (uploaded_by = $2 OR uploaded_by IS NULL)',
        [uniqueCustomerIds, userId]
      );
      const existingIds = new Set(existingRes.rows.map(r => r.customer_id));
      const missingIds = uniqueCustomerIds.filter(id => !existingIds.has(id));

      if (missingIds.length > 0) {
        console.log(`Auto-creating ${missingIds.length} placeholder customers for FK satisfaction...`);
        const CUST_CHUNK = 200;
        for (let i = 0; i < missingIds.length; i += CUST_CHUNK) {
          const chunkIds = missingIds.slice(i, i + CUST_CHUNK);
          const cVals = [];
          const cRows = [];
          let cIdx = 1;
          for (const cid of chunkIds) {
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
    }

    // --- Step 2: Bulk insert transactions with uploaded_by ---
    let inserted = 0;
    const CHUNK_SIZE = 100;
    
    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
      const chunk = transactions.slice(i, i + CHUNK_SIZE);
      const valueRows = [];
      const values = [];
      let pIdx = 1;

      for (const t of chunk) {
        const row = [];
        for (let j = 0; j < 23; j++) {  // 22 original + 1 uploaded_by
          row.push(`$${pIdx++}`);
        }
        valueRows.push(`(${row.join(', ')})`);
        
        values.push(
          t.transaction_id, t.customer_id, t.account_number, t.amount, t.transaction_date,
          t.transaction_type, t.country, t.country_risk_level, t.is_new_device,
          t.degree_centrality, t.path_length_hops, t.balance_before, t.balance_after,
          t.days_since_last_transaction, t.user_transaction_count_7d, t.transaction_frequency_1hr,
          t.destination_id, t.flagged, t.flag_reason, t.rule_triggered, t.risk_score, t.batch_id || null,
          userId  // uploaded_by
        );
      }

      const query = `
        INSERT INTO transactions (
          transaction_id, customer_id, account_number, amount, transaction_date,
          transaction_type, country, country_risk_level, is_new_device,
          degree_centrality, path_length_hops, balance_before, balance_after,
          days_since_last_transaction, user_transaction_count_7d, transaction_frequency_1hr,
          destination_id, flagged, flag_reason, rule_triggered, risk_score, batch_id,
          uploaded_by
        ) VALUES ${valueRows.join(', ')}
        ON CONFLICT (transaction_id) DO NOTHING
      `;

      const result = await pool.query(query, values);
      inserted += result.rowCount;
    }

    res.json({ inserted });
  } catch (err) {
    console.error('Insert transactions error:', err);
    res.status(500).json({ error: 'Failed to insert transactions: ' + err.message });
  }
});

// DELETE /api/transactions — delete only current user's transactions (and alerts)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Delete user's alerts first
    const alertResult = await pool.query('DELETE FROM alerts WHERE uploaded_by = $1', [userId]);
    // Then delete user's transactions
    const txnResult = await pool.query('DELETE FROM transactions WHERE uploaded_by = $1', [userId]);
    res.json({ deleted_transactions: txnResult.rowCount, deleted_alerts: alertResult.rowCount });
  } catch (err) {
    console.error('Delete transactions error:', err);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

module.exports = router;
