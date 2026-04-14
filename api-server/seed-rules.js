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
      ['Geographic Risk', 'Entities in FATF blacklisted/grey-listed jurisdictions (Iran, North Korea, Myanmar, Syria, Yemen, Mali)', 'FATF blacklist/greylist', 'active'],
      ['Cryptocurrency Activity', 'Customers dealing in cryptocurrency transactions are considered higher risk', 'Any crypto transaction', 'active'],
      ['PEP / HNI Flag', 'Politically Exposed Persons or High Net Worth Individuals', 'PEP=true OR HNI narration', 'active'],
      ['Structuring', 'Breaking large amounts into smaller chunks within 30 days to avoid reporting thresholds (₹10,00,000 CTR limit)', 'Cumulative >₹10,00,000 in 30 days', 'active'],
      ['Income Mismatch', 'Transaction volume exceeds customer declared income profile', '>3× monthly income in 30 days', 'active'],
      ['Velocity Spike', 'Abnormal transaction frequency within short time window', '≥5 txns/hour or 3× average', 'active'],
      ['Dormancy Activation', 'Sudden activity on previously dormant account', '>30 days inactive then active', 'active'],
      ['Layering', 'Complex multi-hop fund flows through shell entities to obscure origin', 'path_length ≥4, centrality >0.5', 'active'],
      ['New Device High Value', 'First-time device used for high-value transaction', 'Amount >2× customer average', 'active'],
      ['Rapid Fund Movement', 'Large proportion of account balance moved in single transaction', '≥80% of balance moved', 'active'],
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
