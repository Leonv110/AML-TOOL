const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/documents/customer/:customerId — fetch documents for customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE customer_id = $1 ORDER BY uploaded_at DESC',
      [req.params.customerId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch documents error:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/documents — upload document record
router.post('/', authenticateToken, async (req, res) => {
  try {
    const doc = req.body;
    await pool.query(
      'INSERT INTO documents (customer_id, document_type, file_name, uploaded_by) VALUES ($1, $2, $3, $4)',
      [doc.customer_id, doc.document_type, doc.file_name, doc.uploaded_by || req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Upload document error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

module.exports = router;
