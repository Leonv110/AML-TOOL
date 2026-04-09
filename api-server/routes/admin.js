const express = require('express');
const pool = require('../db');
const axios = require('axios');
const router = express.Router();

router.get('/health-check', async (req, res) => {
  const health = {
    api: 'online',
    db: 'offline',
    ml: 'offline',
    timestamp: new Date().toISOString()
  };

  try {
    // Check DB
    await pool.query('SELECT 1');
    health.db = 'online';
  } catch (err) {
    console.error('Admin Check - DB Offline:', err.message);
  }

  try {
    // Check ML Backend (Python)
    const amlUrl = process.env.AML_BACKEND_URL || process.env.VITE_AML_BACKEND_URL || 'http://localhost:8000';
    const mlResponse = await axios.get(`${amlUrl}/health`, { timeout: 2000 });
    if (mlResponse.data && mlResponse.data.status === 'ok') {
      health.ml = 'online';
    }
  } catch (err) {
    console.error('Admin Check - ML Offline:', err.message);
  }

  res.json(health);
});

module.exports = router;
