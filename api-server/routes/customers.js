const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers — fetch all customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customers ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/countries — distinct countries
router.get('/countries', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT country FROM customers WHERE country IS NOT NULL ORDER BY country'
    );
    res.json(rows.map(r => r.country));
  } catch (err) {
    console.error('Fetch countries error:', err);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// GET /api/customers/:customerId — fetch single customer by customer_id
router.get('/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customers WHERE customer_id = $1',
      [req.params.customerId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Fetch customer error:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// PUT /api/customers/upsert — upsert multiple customers
router.put('/upsert', authenticateToken, async (req, res) => {
  try {
    const customers = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'Array of customers required' });
    }

    let inserted = 0;
    for (const c of customers) {
      await pool.query(
        `INSERT INTO customers (customer_id, account_number, name, normalized_name, date_of_birth, occupation, income, country, pan_aadhaar, pep_flag, last_review)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (customer_id) DO UPDATE SET
           account_number = EXCLUDED.account_number,
           name = EXCLUDED.name,
           normalized_name = EXCLUDED.normalized_name,
           date_of_birth = EXCLUDED.date_of_birth,
           occupation = EXCLUDED.occupation,
           income = EXCLUDED.income,
           country = EXCLUDED.country,
           pan_aadhaar = EXCLUDED.pan_aadhaar,
           pep_flag = EXCLUDED.pep_flag,
           last_review = EXCLUDED.last_review`,
        [c.customer_id, c.account_number, c.name, c.normalized_name, c.date_of_birth, c.occupation, c.income, c.country, c.pan_aadhaar, c.pep_flag, c.last_review]
      );
      inserted++;
    }

    res.json({ inserted });
  } catch (err) {
    console.error('Upsert customers error:', err);
    res.status(500).json({ error: 'Failed to upsert customers' });
  }
});

// PATCH /api/customers/:customerId/pep — update PEP flag
router.patch('/:customerId/pep', authenticateToken, async (req, res) => {
  try {
    const { pep_flag } = req.body;
    await pool.query(
      'UPDATE customers SET pep_flag = $1 WHERE customer_id = $2',
      [pep_flag, req.params.customerId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update PEP error:', err);
    res.status(500).json({ error: 'Failed to update PEP flag' });
  }
});

module.exports = router;
