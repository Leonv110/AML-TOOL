const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function seedAdmin() {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
      process.exit(1);
    }

    // Enforce password strength
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      console.error('❌ Admin password must be at least 8 characters with uppercase, lowercase, and a number');
      process.exit(1);
    }
    const existing = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const userRes = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, hash]);
      await pool.query('INSERT INTO profiles (id, email, role) VALUES ($1, $2, $3)', [userRes.rows[0].id, email, 'admin']);
      console.log('Seeded admin successfully');
    } else {
        // update role just in case
        await pool.query('UPDATE profiles SET role = $1 WHERE email = $2', ['admin', email]);
        // Update password just in case
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, email]);

      console.log('Admin already exists, updated password and role.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
seedAdmin();
