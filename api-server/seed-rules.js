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
      ['Geographic Risk', 'Flags transactions involving FATF blacklisted/grey-listed jurisdictions (e.g., Iran, North Korea, Syria). High value (>15k) gets critical risk.', 'Country Match or High Risk Level', 'active'],
      ['Cryptocurrency Activity', 'Detects if transaction type or destination suggests cryptocurrency dealings (e.g., mentions of "crypto" or "exchange").', 'Keyword match in txn type/dest', 'active'],
      ['PEP / HNI Flag', 'Identifies transactions by Politically Exposed Persons (PEP) or High Net Worth Individuals. Flags high value transactions heavily.', 'PEP=true & Amt > 5000', 'active'],
      ['Structuring', 'Detects multiple transactions below CTR limit (₹10,00,000) that sum up to exceed it within 30 days to evade reporting.', 'Cumulative ≥₹10L & Count ≥2 in 30d', 'active'],
      ['Income Mismatch', 'Calculates Risk Scoring Factor (RSF) = Net Balance / Stated Monthly Income. Flags when RSF exceeds normal bounds (e.g., spending 5x income).', 'RSF > 5x (High), >3x (Med) in 30d', 'active'],
      ['Velocity Spike', 'Flags unusual transaction frequency, especially if occurring during odd hours (midnight to 5 AM IST) or exceeding 3x the 3-month average.', '≥7/hr (Odd) OR ≥4 & 3× avg', 'active'],
      ['Dormancy Activation', 'Detects sudden high-value activity on an account that has been dormant for a significant period (45 or 90+ days).', '>45d inactive & >$5k OR >90d', 'active'],
      ['Layering', 'Identifies complex fund flows through multiple accounts to obscure origin, using graph metrics (hops and centrality).', 'path_length ≥4 & centrality >0.5', 'active'],
      ['New Device High Value', 'Flags when a customer uses a completely new device to initiate an unusually large transaction (>20k).', 'new_device=true & Amt >20k', 'active'],
      ['Rapid Fund Movement', 'Detects quick draining of an account, where a single transaction moves a vast majority (≥85%) of the previous balance.', '≥85% of balance moved & >8k', 'active'],
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
