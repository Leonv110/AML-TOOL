const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkUsers() {
  try {
    const res = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`✅ Connection successful. User count: ${res.rows[0].count}`);
    const users = await pool.query('SELECT id, email FROM users LIMIT 5');
    console.log('--- Sample Users ---');
    console.table(users.rows);
  } catch (err) {
    console.error('❌ Error connecting to database:', err.message);
  } finally {
    await pool.end();
  }
}

checkUsers();
