const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('Connecting to database...');
  try {
    await client.connect();
    console.log('✅ Connected!');
    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log('--- DB INFO ---');
    console.table(res.rows[0]);
    
    console.log('Checking tables...');
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Found tables:', tables.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('❌ Connection failed!');
    console.error('ERROR MESSAGE:', err.message);
    console.error('ERROR STACK:', err.stack);
  } finally {
    await client.end();
  }
}

main();
