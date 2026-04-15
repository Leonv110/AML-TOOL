/**
 * remove-duplicate-rules.js
 * One-time migration: delete the 5 duplicate rules that were added before
 * the canonical 10-rule seed was established.
 *
 * Duplicate rules to delete (old descriptions / thresholds):
 *   - Structuring           threshold: '2,00,000'
 *   - Geographic Risk       threshold: 'FATF grey/blacklist'
 *   - Velocity Spike        threshold: '5+ per hour OR 3x average'
 *   - Dormancy Activation   threshold: '90+ days dormant'
 *   - Layering              threshold: '4+ hops, centrality >0.5'
 *
 * Strategy: for each of these rule names, keep the row with the LOWEST id
 * (the canonical seed entry) and delete all others.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const DUPLICATE_RULE_NAMES = [
  'Structuring',
  'Geographic Risk',
  'Velocity Spike',
  'Dormancy Activation',
  'Layering',
];

async function removeDuplicates() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalDeleted = 0;

    for (const name of DUPLICATE_RULE_NAMES) {
      // Find all rows for this rule name, ordered by id
      const { rows } = await client.query(
        'SELECT id FROM rules WHERE name = $1 ORDER BY id ASC',
        [name]
      );

      if (rows.length <= 1) {
        console.log(`✅  "${name}" — only 1 entry found, nothing to remove.`);
        continue;
      }

      // Keep the first (lowest id), delete the rest
      const keepId = rows[0].id;
      const deleteIds = rows.slice(1).map(r => r.id);

      const res = await client.query(
        'DELETE FROM rules WHERE id = ANY($1::uuid[])',
        [deleteIds]
      );

      console.log(`🗑️   "${name}" — kept id=${keepId}, deleted ids=[${deleteIds.join(', ')}] (${res.rowCount} row(s))`);
      totalDeleted += res.rowCount;
    }

    await client.query('COMMIT');

    // Verify final count
    const { rows: remaining } = await client.query('SELECT COUNT(*) FROM rules');
    console.log(`\n✅  Done. Total deleted: ${totalDeleted}. Rules remaining: ${remaining[0].count}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Migration failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

removeDuplicates();
