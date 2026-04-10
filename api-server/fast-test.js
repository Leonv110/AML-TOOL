const { Pool } = require('pg');
require('dotenv').config();

console.log('START TEST');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

pool.query('SELECT 1')
  .then(() => console.log('OK'))
  .catch(err => {
    console.error('FAIL');
    console.error(err.message);
  })
  .finally(() => {
    console.log('END TEST');
    pool.end();
  });
