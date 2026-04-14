const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

/**
 * @swagger
 * /rules:
 *   get:
 *     summary: Get all AML detection rules
 *     tags: [Rules]
 *     responses:
 *       200:
 *         description: Array of rules with status and thresholds
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Rule'
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM rules ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch rules error:', err);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

/**
 * @swagger
 * /rules/{id}/status:
 *   patch:
 *     summary: Toggle a rule active/inactive
 *     tags: [Rules]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Rule status updated
 */
router.patch('/:id/status', authenticateToken, validate(schemas.toggleRuleStatus), async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query(
      'UPDATE rules SET status = $1 WHERE id = $2',
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Toggle rule status error:', err);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

module.exports = router;
