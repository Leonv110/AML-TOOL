const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function seedLayeringData() {
  try {
    // Insert 4 Dummy Customers
    const customers = [
      ['LAY-C1', 'ACC-LAY1', 'Alpha Corp', 'alpha corp', '2000-01-01', 'Trading', 5000, 'India', null, false],
      ['LAY-C2', 'ACC-LAY2', 'Beta Logistics', 'beta logistics', '2005-02-02', 'Transport', 6000, 'UAE', null, false],
      ['LAY-C3', 'ACC-LAY3', 'Gamma Holdings', 'gamma holdings', '2010-03-03', 'Investment', 8000, 'Panama', null, false],
      ['LAY-C4', 'ACC-LAY4', 'Delta Trade', 'delta trade', '2015-04-04', 'Consulting', 4000, 'India', null, false]
    ];
    
    console.log('Inserting Layering Customers...');
    for (const c of customers) {
      await pool.query(`
        INSERT INTO customers (
          customer_id, account_number, name, normalized_name, 
          date_of_birth, occupation, income, country, pan_aadhaar, pep_flag
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (customer_id) DO NOTHING
      `, c);
    }

    // Insert 4 transactions mimicking circular flow
    // path_length_hops >= 4 and degree_centrality > 0.5 triggers the layering rule
    const batchId = 'BATCH-LAYERING-' + Date.now();
    const transactions = [
      ['TXN-L1', 'LAY-C1', 'ACC-LAY1', 12000, new Date().toISOString(), 'Transfer Out', 'India', 'Low', false, 0.85, 4, 15000, 3000, 0, 1, 2, 'LAY-C2', batchId],
      ['TXN-L2', 'LAY-C2', 'ACC-LAY2', 11500, new Date().toISOString(), 'Transfer Out', 'UAE', 'Medium', false, 0.70, 4, 12000, 500, 0, 2, 2.5, 'LAY-C3', batchId],
      ['TXN-L3', 'LAY-C3', 'ACC-LAY3', 11000, new Date().toISOString(), 'Transfer Out', 'Panama', 'High', false, 0.60, 4, 11500, 500, 0, 3, 3, 'LAY-C4', batchId],
      ['TXN-L4', 'LAY-C4', 'ACC-LAY4', 10500, new Date().toISOString(), 'Transfer Out', 'India', 'Low', false, 0.90, 4, 11000, 500, 0, 4, 3.5, 'LAY-C1', batchId],
    ];

    console.log('Inserting Layering Transactions...');
    for (const t of transactions) {
      // Add multiple structuring-style transactions maybe? No, just layering.
      await pool.query(`
        INSERT INTO transactions (
          transaction_id, customer_id, account_number, amount, transaction_date,
          transaction_type, country, country_risk_level, is_new_device,
          degree_centrality, path_length_hops, balance_before, balance_after,
          days_since_last_transaction, user_transaction_count_7d, transaction_frequency_1hr,
          destination_id, batch_id
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (transaction_id) DO NOTHING
      `, t);
    }
    
    console.log('✅ Successfully seeded Layering mock data.');
  } catch (err) {
    console.error('❌ Failed to seed layering data:', err.message);
  } finally {
    pool.end();
  }
}

seedLayeringData();
