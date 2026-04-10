const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  try {
    const countriesPath = path.join(__dirname, '..', 'countriesMap.json');
    if (fs.existsSync(countriesPath)) {
      const data = fs.readFileSync(countriesPath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ error: 'Countries mapping not found' });
    }
  } catch (err) {
    console.error('Error fetching countries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
