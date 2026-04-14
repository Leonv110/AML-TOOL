const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');
const { amlWatcherRequest } = require('../services/amlWatcherService');

const router = express.Router();

// GET /api/customers — fetch current user's customers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customers WHERE (uploaded_by = $1 OR uploaded_by IS NULL) ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/countries — distinct countries for current user
router.get('/countries', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT DISTINCT country FROM customers WHERE country IS NOT NULL AND (uploaded_by = $1 OR uploaded_by IS NULL) ORDER BY country',
      [req.user.id]
    );
    res.json(rows.map(r => r.country));
  } catch (err) {
    console.error('Fetch countries error:', err);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// GET /api/customers/:customerId — fetch single customer (user-scoped)
router.get('/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customers WHERE customer_id = $1 AND (uploaded_by = $2 OR uploaded_by IS NULL)',
      [req.params.customerId, req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Fetch customer error:', err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// PUT /api/customers/upsert — upsert multiple customers with user ownership
router.put('/upsert', authenticateToken, async (req, res) => {
  try {
    const customers = req.body;
    const userId = req.user.id;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'Array of customers required' });
    }

    let inserted = 0;
    for (const c of customers) {
      await pool.query(
        `INSERT INTO customers (customer_id, account_number, name, normalized_name, date_of_birth, occupation, income, country, pan_aadhaar, pep_flag, last_review, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
           last_review = EXCLUDED.last_review,
           uploaded_by = EXCLUDED.uploaded_by`,
        [c.customer_id, c.account_number, c.name, c.normalized_name, c.date_of_birth, c.occupation, c.income, c.country, c.pan_aadhaar, c.pep_flag, c.last_review, userId]
      );
      inserted++;
    }

    res.json({ inserted });
  } catch (err) {
    console.error('Upsert customers error:', err);
    res.status(500).json({ error: 'Failed to upsert customers' });
  }
});

// PATCH /api/customers/:customerId/pep — update PEP flag (user-scoped)
router.patch('/:customerId/pep', authenticateToken, async (req, res) => {
  try {
    const { pep_flag } = req.body;
    await pool.query(
      'UPDATE customers SET pep_flag = $1 WHERE customer_id = $2 AND (uploaded_by = $3 OR uploaded_by IS NULL)',
      [pep_flag, req.params.customerId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update PEP error:', err);
    res.status(500).json({ error: 'Failed to update PEP flag' });
  }
});

// POST /api/customers/:customerId/screen — Screen customer against AML Watcher
router.post('/:customerId/screen', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customers WHERE customer_id = $1 AND (uploaded_by = $2 OR uploaded_by IS NULL)',
      [req.params.customerId, req.user.id]
    );
    const customer = rows[0];

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const payload = {
      name: customer.name,
      country: customer.country || "",
    };

    const amlResult = await amlWatcherRequest('/api/v1/search', payload, 'POST');

    res.json({ success: true, screeningResult: amlResult });
  } catch (err) {
    console.error('AML Screening error:', err);
    res.status(500).json({ error: 'Failed to screen customer via AML Watcher' });
  }
});

// POST /api/customers/manual-screen — Send formatted payload to AML Watcher
// Per-user rate limiting: max 10 screening requests per user per hour
const rateLimit = require('express-rate-limit');
const screeningLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip, // per-user, not per-IP
  message: { error: 'Screening limit reached (10/hour). Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post('/manual-screen', authenticateToken, screeningLimiter, async (req, res) => {
  try {
    let payload = { ...req.body };
    const apiKey = process.env.AMLWATCHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'AML Watcher API Key is not configured on the server.' });
    }
    payload.api_key = apiKey;

    if (payload.exact_search) {
      payload.match_score = 100;
    }

    if (payload.adverse_media_monitoring) {
      if (!payload.webhook || !/^https?:\/\//.test(payload.webhook)) {
        return res.status(400).json({ error: 'A valid webhook URL is required when adverse media monitoring is enabled' });
      }
    }

    if (payload.birth_incorporation_date === '00-00-0000') {
      delete payload.birth_incorporation_date;
    }

    const cleanObject = (obj) => {
      Object.keys(obj).forEach(key => {
        if (obj[key] === null || obj[key] === '') {
          delete obj[key];
        } else if (Array.isArray(obj[key]) && obj[key].length === 0) {
          delete obj[key];
        } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          cleanObject(obj[key]);
          if (Object.keys(obj[key]).length === 0) {
            delete obj[key];
          }
        }
      });
    };
    cleanObject(payload);

    const response = await axios.post('https://api.amlwatcher.com/api/search', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    res.json({ success: true, screeningResult: response.data });
  } catch (err) {
    if (err.response) {
      console.error('Manual Screening API Error:', err.response.data);
      return res.status(err.response.status).json({ error: err.response.data.message || 'API request failed', details: err.response.data });
    }
    console.error('Manual Screening error:', err);
    res.status(500).json({ error: 'Failed to screen via AML Watcher' });
  }
});

// DELETE /api/customers — delete only current user's customers (and related data)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Cascading delete: only user's data
    await pool.query('DELETE FROM notes WHERE created_by = $1', [userId]);
    await pool.query('DELETE FROM documents WHERE uploaded_by = $1', [userId]);
    await pool.query('DELETE FROM investigations WHERE created_by = $1 OR created_by IS NULL', [userId]);
    await pool.query('DELETE FROM alerts WHERE uploaded_by = $1', [userId]);
    await pool.query('DELETE FROM transactions WHERE uploaded_by = $1', [userId]);
    const result = await pool.query('DELETE FROM customers WHERE uploaded_by = $1', [userId]);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    console.error('Delete customers error:', err);
    res.status(500).json({ error: 'Failed to delete customers' });
  }
});

module.exports = router;
