const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions — fetch all with optional filters and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, minAmount, maxAmount, country, rule, page } = req.query;
    // Allow up to 50000 rows per page, default 500
    const limit = Math.min(parseInt(req.query.limit) || 500, 50000);
    const offset = ((parseInt(page) || 1) - 1) * limit;

    let query = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];
    let idx = 1;

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

// PATCH /api/transactions/flag — batch update flagged status on transactions
router.patch('/flag', authenticateToken, async (req, res) => {
  try {
    const updates = req.body; // Array of { transaction_id, flagged, flag_reason, rule_triggered }
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Array of flag updates required' });
    }

    let updated = 0;
    const CHUNK_SIZE = 200;

    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const ids = chunk.map(u => u.transaction_id);
      
      // Build individual CASE statements for each field
      let flagReasonCases = '';
      let ruleTriggeredCases = '';
      const params = [];
      let pIdx = 1;

      for (const u of chunk) {
        flagReasonCases += ` WHEN transaction_id = $${pIdx++} THEN $${pIdx++}`;
        params.push(u.transaction_id, u.flag_reason || '');
        ruleTriggeredCases += ` WHEN transaction_id = $${pIdx++} THEN $${pIdx++}`;
        params.push(u.transaction_id, u.rule_triggered || '');
      }

      // Add the list of IDs for the WHERE clause
      const idPlaceholders = ids.map(() => `$${pIdx++}`);
      params.push(...ids);

      const query = `
        UPDATE transactions SET
          flagged = TRUE,
          flag_reason = CASE ${flagReasonCases} END,
          rule_triggered = CASE ${ruleTriggeredCases} END
        WHERE transaction_id IN (${idPlaceholders.join(', ')})
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

    // --- Step 1: Auto-create any missing customers so FK constraint is satisfied ---
    const uniqueCustomerIds = [...new Set(
      transactions.map(t => t.customer_id).filter(Boolean)
    )];

    if (uniqueCustomerIds.length > 0) {
      // Find which customer_ids already exist
      const existingRes = await pool.query(
        'SELECT customer_id FROM customers WHERE customer_id = ANY($1)',
        [uniqueCustomerIds]
      );
      const existingIds = new Set(existingRes.rows.map(r => r.customer_id));
      const missingIds = uniqueCustomerIds.filter(id => !existingIds.has(id));

      // Bulk-insert placeholder customers for any missing IDs
      if (missingIds.length > 0) {
        console.log(`Auto-creating ${missingIds.length} placeholder customers for FK satisfaction...`);
        const custValues = [];
        const custRows = [];
        let ci = 1;
        for (const cid of missingIds) {
          // customer_id, account_number (unique), name, normalized_name
          const accNum = `ACC-${cid}`;
          const name = `Customer ${cid}`;
          custRows.push(`($${ci++}, $${ci++}, $${ci++}, $${ci++})`);
          custValues.push(cid, accNum, name, name.toLowerCase());
        }
        // Insert in chunks of 200 to avoid param limits
        const CUST_CHUNK = 200;
        for (let i = 0; i < missingIds.length; i += CUST_CHUNK) {
          const chunkIds = missingIds.slice(i, i + CUST_CHUNK);
          const cVals = [];
          const cRows = [];
          let cIdx = 1;
          for (const cid of chunkIds) {
            cRows.push(`($${cIdx++}, $${cIdx++}, $${cIdx++}, $${cIdx++})`);
            cVals.push(cid, `ACC-${cid}`, `Customer ${cid}`, `customer ${cid}`);
          }
          await pool.query(
            `INSERT INTO customers (customer_id, account_number, name, normalized_name)
             VALUES ${cRows.join(', ')}
             ON CONFLICT (customer_id) DO NOTHING`,
            cVals
          );
        }
      }
    }

    // --- Step 2: Bulk insert transactions ---
    let inserted = 0;
    const CHUNK_SIZE = 100;
    
    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
      const chunk = transactions.slice(i, i + CHUNK_SIZE);
      const valueRows = [];
      const values = [];
      let pIdx = 1;

      for (const t of chunk) {
        const row = [];
        for (let j = 0; j < 22; j++) {
          row.push(`$${pIdx++}`);
        }
        valueRows.push(`(${row.join(', ')})`);
        
        values.push(
          t.transaction_id, t.customer_id, t.account_number, t.amount, t.transaction_date,
          t.transaction_type, t.country, t.country_risk_level, t.is_new_device,
          t.degree_centrality, t.path_length_hops, t.balance_before, t.balance_after,
          t.days_since_last_transaction, t.user_transaction_count_7d, t.transaction_frequency_1hr,
          t.destination_id, t.flagged, t.flag_reason, t.rule_triggered, t.risk_score, t.batch_id || null
        );
      }

      const query = `
        INSERT INTO transactions (
          transaction_id, customer_id, account_number, amount, transaction_date,
          transaction_type, country, country_risk_level, is_new_device,
          degree_centrality, path_length_hops, balance_before, balance_after,
          days_since_last_transaction, user_transaction_count_7d, transaction_frequency_1hr,
          destination_id, flagged, flag_reason, rule_triggered, risk_score, batch_id
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

// DELETE /api/transactions — delete all transactions (and related alerts)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    // Delete alerts first (they reference transactions via transaction_id)
    const alertResult = await pool.query('DELETE FROM alerts');
    // Then delete transactions
    const txnResult = await pool.query('DELETE FROM transactions');
    res.json({ deleted_transactions: txnResult.rowCount, deleted_alerts: alertResult.rowCount });
  } catch (err) {
    console.error('Delete transactions error:', err);
    res.status(500).json({ error: 'Failed to delete transactions' });
  }
});

module.exports = router;

