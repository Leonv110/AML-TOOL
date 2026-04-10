const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query('SELECT 1')
  .then(() => console.log('OK'))
  .catch(err => {
    console.error('ERROR_START');
    console.error(err.message);
    console.error(err.stack);
    console.error('ERROR_END');
  })
  .finally(() => pool.end());
