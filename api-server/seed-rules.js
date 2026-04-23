const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function seedRules() {
  try {
    // Check if rules already exist
    const existing = await pool.query('SELECT COUNT(*) FROM rules');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`⚠️  Rules table already has ${existing.rows[0].count} rules. Skipping seed.`);
      process.exit(0);
    }

    const rules = [
      ['Geographic Risk', 'Entities in FATF blacklisted/grey-listed jurisdictions (Iran, North Korea, Myanmar, Syria, Yemen, Mali)', 'FATF blacklist/greylist, weight=25-35', 'active'],
      ['Cryptocurrency Activity', 'Transactions involving crypto exchanges, wallets, or digital assets — high risk per regulatory guidance', 'Any crypto/bitcoin/eth/wallet txn, weight=35', 'active'],
      ['PEP / HNI Flag', 'Politically Exposed Persons or High Net Worth Individuals flagged via screening', 'PEP=true OR HNI narration, weight=25', 'active'],
      ['Structuring', 'Breaking amounts below ₹10,00,000 CTR reporting limit over 30-day window to avoid detection', 'Cumulative >₹10L in 30 days across ≥2 txns', 'active'],
      ['Income Mismatch', 'Transaction volume exceeds customer average declared income profile', '>3× avg monthly income in 30 days, weight=25', 'active'],
      ['Velocity Spike', 'Abnormal transaction frequency or activity at odd hours (midnight–5AM IST)', '≥3 txns/hr at odd hours OR ≥7 txns/hr, weight=25-35', 'active'],
      ['Dormancy Activation', 'Sudden activity on previously dormant account', '>45 days inactive + high value, weight=25', 'active'],
      ['Layering', 'Complex multi-hop fund flows through shell entities forming cyclic networks', 'path_length ≥4, centrality >0.5, weight=25', 'active'],
      ['New Device High Value', 'First-time device used for high-value transaction (low AML relevance)', 'Amount >₹20,000 + new device, weight=10', 'active'],
      ['Rapid Fund Movement', 'Large proportion of account balance drained in single transaction', '≥85% of balance moved, weight=35', 'active'],
    ];

    for (const [name, description, threshold, status] of rules) {
      await pool.query(
        'INSERT INTO rules (name, description, threshold, status) VALUES ($1, $2, $3, $4)',
        [name, description, threshold, status]
      );
    }

    console.log(`✅ Successfully seeded ${rules.length} AML rules`);
  } catch (err) {
    console.error('❌ Failed to seed rules:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seedRules();
