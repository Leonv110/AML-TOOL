const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const CHAIN_SECRET = process.env.AUDIT_CHAIN_SECRET || process.env.JWT_SECRET || 'fallback-chain-key';

// --- Helper: compute HMAC for chain linking ---
function computeChainHash(data) {
  return crypto.createHmac('sha256', CHAIN_SECRET).update(data).digest('hex');
}

// ============================================================
// GET /api/audit — fetch audit logs (with optional filters)
// ============================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { event_type, actor_id, limit = 200, offset = 0 } = req.query;
    let query = 'SELECT * FROM audit_logs';
    const conditions = [];
    const params = [];

    if (event_type) {
      params.push(event_type);
      conditions.push(`event_type = $${params.length}`);
    }
    if (actor_id) {
      params.push(actor_id);
      conditions.push(`actor_id = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY timestamp DESC';
    params.push(parseInt(limit, 10));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset, 10));
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch audit logs error:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ============================================================
// POST /api/audit — insert with hash-chain linking (Pillar 1)
// ============================================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { event_type, actor_id, actor_role, entity_type, entity_id, metadata, timestamp, hmac_signature } = req.body;
    if (!event_type || !hmac_signature) {
      return res.status(400).json({ error: 'event_type and hmac_signature are required' });
    }

    // Get the previous entry's hash for chain linking
    const prevResult = await pool.query(
      'SELECT hmac_signature, sequence_number FROM audit_logs ORDER BY sequence_number DESC LIMIT 1'
    );
    const prev_hash = prevResult.rows.length > 0 ? prevResult.rows[0].hmac_signature : null;

    // Compute chain hash: HMAC(prev_hash + current_data)
    const chainData = JSON.stringify({ prev_hash, event_type, actor_id, entity_type, entity_id, timestamp });
    const chain_hash = computeChainHash(chainData);

    const result = await pool.query(
      `INSERT INTO audit_logs (event_type, actor_id, actor_role, entity_type, entity_id, metadata, timestamp, hmac_signature, prev_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [event_type, actor_id || null, actor_role || 'unknown', entity_type || null, entity_id || null,
       metadata ? JSON.stringify(metadata) : null, timestamp || new Date().toISOString(), hmac_signature, prev_hash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Insert audit log error:', err);
    res.status(500).json({ error: 'Failed to insert audit log' });
  }
});

// ============================================================
// GET /api/audit/chain/verify — Pillar 1: Hash chain verification
// ============================================================
router.get('/chain/verify', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_logs ORDER BY sequence_number ASC');
    if (rows.length === 0) return res.json({ intact: true, total_entries: 0, breaks: [], gaps: [] });

    const breaks = [];
    const gaps = [];

    for (let i = 1; i < rows.length; i++) {
      const current = rows[i];
      const previous = rows[i - 1];

      // Check chain link: current.prev_hash should match previous.hmac_signature
      if (current.prev_hash && current.prev_hash !== previous.hmac_signature) {
        breaks.push({
          at_sequence: current.sequence_number,
          expected: previous.hmac_signature,
          got: current.prev_hash,
          timestamp: current.timestamp
        });
      }

      // Check sequence gaps (deleted entries)
      const expectedSeq = previous.sequence_number + 1;
      if (current.sequence_number !== expectedSeq) {
        gaps.push({
          after_sequence: previous.sequence_number,
          expected_next: expectedSeq,
          actual_next: current.sequence_number,
          missing_count: current.sequence_number - expectedSeq
        });
      }
    }

    res.json({
      intact: breaks.length === 0 && gaps.length === 0,
      total_entries: rows.length,
      first_entry: rows[0].timestamp,
      last_entry: rows[rows.length - 1].timestamp,
      breaks,
      gaps,
      verified_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Chain verify error:', err);
    res.status(500).json({ error: 'Chain verification failed' });
  }
});

// ============================================================
// GET /api/audit/chain/export — Pillar 1: Signed JSON export
// ============================================================
router.get('/chain/export', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM audit_logs';
    const params = [];
    const conditions = [];

    if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`timestamp <= $${params.length}`); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sequence_number ASC';

    const { rows } = await pool.query(query, params);

    // Compute master hash of entire exported chain
    const chainContent = JSON.stringify(rows);
    const master_hash = computeChainHash(chainContent);

    res.json({
      export_metadata: {
        institution: 'GAFA AML Training Platform',
        exported_by: req.user.email,
        exported_at: new Date().toISOString(),
        period: { from: from || 'beginning', to: to || 'now' },
        total_entries: rows.length,
        master_hash,
        hash_algorithm: 'HMAC-SHA256'
      },
      chain: rows
    });
  } catch (err) {
    console.error('Chain export error:', err);
    res.status(500).json({ error: 'Chain export failed' });
  }
});

// ============================================================
// GET /api/audit/analytics/rule-effectiveness — Pillar 2
// ============================================================
router.get('/analytics/rule-effectiveness', authenticateToken, async (req, res) => {
  try {
    // Get all alert-related audit events
    const { rows: auditRows } = await pool.query(`
      SELECT event_type, metadata, timestamp
      FROM audit_logs
      WHERE event_type IN ('ALERT_CLOSED', 'ALERT_ESCALATED', 'SAR_CLOSED_FALSE_POSITIVE', 'SAR_ESCALATED', 'SAR_DRAFT_SAR')
      ORDER BY timestamp DESC
    `);

    // Get all rules for reference
    const { rows: rules } = await pool.query('SELECT name, description, threshold, status FROM rules');

    // Build per-rule stats
    const ruleStats = {};
    rules.forEach(r => { ruleStats[r.name] = { total: 0, escalated: 0, false_positive: 0, last_7d: { escalated: 0, false_positive: 0 }, prev_7d: { escalated: 0, false_positive: 0 } }; });

    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 86400000);
    const fourteenDaysAgo = new Date(now - 14 * 86400000);

    auditRows.forEach(row => {
      let meta = row.metadata;
      if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
      const ruleName = meta?.rule || meta?.rule_name || meta?.rule_triggered || 'Unknown';
      if (!ruleStats[ruleName]) {
        ruleStats[ruleName] = { total: 0, escalated: 0, false_positive: 0, last_7d: { escalated: 0, false_positive: 0 }, prev_7d: { escalated: 0, false_positive: 0 } };
      }

      const ts = new Date(row.timestamp);
      const isEscalation = ['ALERT_ESCALATED', 'SAR_ESCALATED', 'SAR_DRAFT_SAR'].includes(row.event_type);
      const isFP = ['ALERT_CLOSED', 'SAR_CLOSED_FALSE_POSITIVE'].includes(row.event_type);

      ruleStats[ruleName].total++;
      if (isEscalation) ruleStats[ruleName].escalated++;
      if (isFP) ruleStats[ruleName].false_positive++;

      if (ts >= sevenDaysAgo) {
        if (isEscalation) ruleStats[ruleName].last_7d.escalated++;
        if (isFP) ruleStats[ruleName].last_7d.false_positive++;
      } else if (ts >= fourteenDaysAgo) {
        if (isEscalation) ruleStats[ruleName].prev_7d.escalated++;
        if (isFP) ruleStats[ruleName].prev_7d.false_positive++;
      }
    });

    // Compute precision scores and trends
    const results = Object.entries(ruleStats).map(([name, s]) => {
      const decided = s.escalated + s.false_positive;
      const precision = decided > 0 ? Math.round((s.escalated / decided) * 100) : null;

      const last7decided = s.last_7d.escalated + s.last_7d.false_positive;
      const prev7decided = s.prev_7d.escalated + s.prev_7d.false_positive;
      const last7precision = last7decided > 0 ? (s.last_7d.escalated / last7decided) * 100 : null;
      const prev7precision = prev7decided > 0 ? (s.prev_7d.escalated / prev7decided) * 100 : null;

      let trend_7d = 'stable';
      if (last7precision !== null && prev7precision !== null) {
        const diff = last7precision - prev7precision;
        if (diff > 5) trend_7d = 'improving';
        else if (diff < -5) trend_7d = 'degrading';
      }

      // Auto-suggest threshold adjustment (Pillar 2 enhancement)
      let recommendation = 'Optimal';
      let suggested_action = null;
      if (precision !== null) {
        if (precision < 30) {
          recommendation = 'Critical — Review threshold';
          suggested_action = `Rule "${name}" has ${s.false_positive} false positives vs ${s.escalated} escalations. Consider raising the detection threshold or adding qualifier conditions to reduce noise.`;
        } else if (precision < 60) {
          recommendation = 'Monitor — Precision below target';
          suggested_action = `Precision at ${precision}% is below the 60% target. Review recent false positive patterns for tuning opportunities.`;
        } else if (precision >= 80) {
          recommendation = 'Optimal';
        } else {
          recommendation = 'Acceptable';
        }
      }

      const ruleInfo = rules.find(r => r.name === name);
      return {
        rule_name: name,
        description: ruleInfo?.description || null,
        threshold: ruleInfo?.threshold || null,
        status: ruleInfo?.status || 'unknown',
        total_alerts: s.total, escalated: s.escalated, false_positive: s.false_positive,
        precision_score: precision,
        trend_7d,
        recommendation,
        suggested_action
      };
    });

    results.sort((a, b) => (a.precision_score ?? 999) - (b.precision_score ?? 999));
    res.json(results);
  } catch (err) {
    console.error('Rule effectiveness error:', err);
    res.status(500).json({ error: 'Failed to compute rule effectiveness' });
  }
});

// ============================================================
// GET /api/audit/analytics/analyst-behavior — Pillar 3 (session-level)
// ============================================================
router.get('/analytics/analyst-behavior', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT actor_id, actor_role, event_type, metadata, timestamp
      FROM audit_logs
      WHERE actor_id IS NOT NULL
      ORDER BY actor_id, timestamp ASC
    `);

    // Group by actor
    const actorMap = {};
    rows.forEach(r => {
      if (!actorMap[r.actor_id]) actorMap[r.actor_id] = { role: r.actor_role, events: [] };
      actorMap[r.actor_id].events.push(r);
    });

    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min gap = new session
    const analysts = [];

    for (const [actorId, data] of Object.entries(actorMap)) {
      const sessions = [];
      let currentSession = [data.events[0]];

      for (let i = 1; i < data.events.length; i++) {
        const gap = new Date(data.events[i].timestamp) - new Date(data.events[i - 1].timestamp);
        if (gap > SESSION_GAP_MS) {
          sessions.push(currentSession);
          currentSession = [];
        }
        currentSession.push(data.events[i]);
      }
      if (currentSession.length) sessions.push(currentSession);

      // Session-level anomaly detection
      const anomalies = [];
      let totalAlertDecisions = 0, totalFP = 0, totalEscalated = 0;
      let totalCustomersViewed = 0;

      sessions.forEach((session, idx) => {
        const durationMs = session.length > 1
          ? new Date(session[session.length - 1].timestamp) - new Date(session[0].timestamp)
          : 0;
        const durationMin = durationMs / 60000;

        const alertDecisions = session.filter(e =>
          ['ALERT_CLOSED', 'ALERT_ESCALATED', 'SAR_CLOSED_FALSE_POSITIVE', 'SAR_ESCALATED'].includes(e.event_type));
        const fpCount = alertDecisions.filter(e => ['ALERT_CLOSED', 'SAR_CLOSED_FALSE_POSITIVE'].includes(e.event_type)).length;
        const escCount = alertDecisions.filter(e => ['ALERT_ESCALATED', 'SAR_ESCALATED'].includes(e.event_type)).length;
        const customerViews = session.filter(e => e.event_type === 'CUSTOMER_VIEWED').length;

        totalAlertDecisions += alertDecisions.length;
        totalFP += fpCount;
        totalEscalated += escCount;
        totalCustomersViewed += customerViews;

        // Rubber-stamping: >5 alert decisions in <3 minutes
        if (alertDecisions.length > 5 && durationMin < 3) {
          anomalies.push({ type: 'RUBBER_STAMPING', severity: 'high', session_index: idx,
            detail: `${alertDecisions.length} alert decisions in ${durationMin.toFixed(1)} minutes` });
        }

        // Bulk customer access: >20 customers in one session
        if (customerViews > 20) {
          anomalies.push({ type: 'BULK_DATA_ACCESS', severity: 'medium', session_index: idx,
            detail: `${customerViews} customer profiles accessed in one session` });
        }

        // One-directional decisions: all same direction in session with 5+ decisions
        if (alertDecisions.length >= 5) {
          if (fpCount === alertDecisions.length) {
            anomalies.push({ type: 'ALL_FALSE_POSITIVE', severity: 'high', session_index: idx,
              detail: `All ${fpCount} decisions were false positive dismissals` });
          } else if (escCount === alertDecisions.length) {
            anomalies.push({ type: 'ALL_ESCALATED', severity: 'low', session_index: idx,
              detail: `All ${escCount} decisions were escalations (may indicate batch processing)` });
          }
        }

        // Off-hours activity
        const sessionHour = new Date(session[0].timestamp).getHours();
        if (sessionHour < 6 || sessionHour > 22) {
          anomalies.push({ type: 'OFF_HOURS', severity: 'medium', session_index: idx,
            detail: `Session started at ${sessionHour}:00 (outside business hours)` });
        }
      });

      const fpRate = totalAlertDecisions > 0 ? Math.round((totalFP / totalAlertDecisions) * 100) : null;

      analysts.push({
        actor_id: actorId, role: data.role,
        total_sessions: sessions.length,
        total_events: data.events.length,
        total_alert_decisions: totalAlertDecisions,
        false_positive_rate: fpRate,
        total_customers_viewed: totalCustomersViewed,
        anomalies,
        risk_level: anomalies.some(a => a.severity === 'high') ? 'high'
          : anomalies.some(a => a.severity === 'medium') ? 'medium' : 'low'
      });
    }

    analysts.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      return (sev[b.risk_level] || 0) - (sev[a.risk_level] || 0);
    });

    res.json(analysts);
  } catch (err) {
    console.error('Analyst behavior error:', err);
    res.status(500).json({ error: 'Failed to analyze analyst behavior' });
  }
});

// ============================================================
// GET /api/audit/analytics/compliance-score — Pillar 4
// ============================================================
router.get('/analytics/compliance-score', authenticateToken, async (req, res) => {
  try {
    const { rows: allLogs } = await pool.query('SELECT * FROM audit_logs ORDER BY sequence_number ASC');
    const { rows: investigations } = await pool.query('SELECT * FROM investigations');

    // 1. COVERAGE (20%): Are key actions being logged?
    const eventTypes = new Set(allLogs.map(l => l.event_type));
    const requiredEvents = ['AUTH_LOGIN', 'AUTH_LOGOUT', 'CUSTOMER_VIEWED', 'ALERT_ESCALATED', 'ALERT_CLOSED'];
    const coveredEvents = requiredEvents.filter(e => eventTypes.has(e));
    const coverageScore = requiredEvents.length > 0 ? Math.round((coveredEvents.length / requiredEvents.length) * 100) : 0;

    // 2. TIMELINESS (20%): Alert response times
    const alertCreations = allLogs.filter(l => l.event_type === 'AML_PROCESSING_COMPLETE');
    const alertDecisions = allLogs.filter(l => ['ALERT_CLOSED', 'ALERT_ESCALATED'].includes(l.event_type));
    let timelinessScore = 100; // Default full if no alerts
    if (alertCreations.length > 0 && alertDecisions.length > 0) {
      const avgResponseHours = alertDecisions.reduce((sum, d) => {
        const creation = alertCreations.find(c => new Date(c.timestamp) < new Date(d.timestamp));
        if (creation) {
          return sum + (new Date(d.timestamp) - new Date(creation.timestamp)) / 3600000;
        }
        return sum;
      }, 0) / alertDecisions.length;
      timelinessScore = avgResponseHours <= 24 ? 100 : avgResponseHours <= 48 ? 80 : avgResponseHours <= 72 ? 60 : 40;
    }

    // 3. INTEGRITY (20%): Chain + HMAC status
    let integrityScore = 100;
    let chainBreaks = 0;
    for (let i = 1; i < allLogs.length; i++) {
      if (allLogs[i].prev_hash && allLogs[i].prev_hash !== allLogs[i - 1].hmac_signature) chainBreaks++;
      if (allLogs[i].sequence_number !== allLogs[i - 1].sequence_number + 1) chainBreaks++;
    }
    if (allLogs.length > 0) {
      integrityScore = Math.max(0, 100 - (chainBreaks * 10));
    }

    // 4. DECISION QUALITY (20%): Rule precision distribution
    const decisions = allLogs.filter(l =>
      ['ALERT_CLOSED', 'ALERT_ESCALATED', 'SAR_CLOSED_FALSE_POSITIVE', 'SAR_ESCALATED'].includes(l.event_type));
    const fpCount = decisions.filter(d => ['ALERT_CLOSED', 'SAR_CLOSED_FALSE_POSITIVE'].includes(d.event_type)).length;
    const escCount = decisions.filter(d => ['ALERT_ESCALATED', 'SAR_ESCALATED'].includes(d.event_type)).length;
    const totalDecisions = fpCount + escCount;
    let qualityScore = 100;
    if (totalDecisions > 0) {
      const fpRate = fpCount / totalDecisions;
      qualityScore = fpRate > 0.8 ? 30 : fpRate > 0.6 ? 50 : fpRate > 0.4 ? 70 : 90;
    }

    // 5. REGULATORY DEADLINE (20%): PMLA 7-day STR filing
    let regulatoryScore = 100;
    const sarDrafts = allLogs.filter(l => l.event_type === 'SAR_DRAFT_SAR');
    let breaches = 0;
    investigations.forEach(inv => {
      if (inv.status === 'open' || inv.decision === 'draft-sar') {
        const createdAt = new Date(inv.created_at);
        const daysSince = (Date.now() - createdAt) / 86400000;
        const hasSAR = sarDrafts.some(s => {
          let meta = s.metadata;
          if (typeof meta === 'string') try { meta = JSON.parse(meta); } catch { meta = {}; }
          return meta?.case_id === inv.case_id || meta?.customer_id === inv.customer_id;
        });
        if (daysSince > 7 && !hasSAR) breaches++;
      }
    });
    if (investigations.length > 0) {
      regulatoryScore = Math.max(0, 100 - (breaches * 20));
    }

    const overall = Math.round((coverageScore + timelinessScore + integrityScore + qualityScore + regulatoryScore) / 5);

    const gaps = [];
    if (coverageScore < 80) gaps.push(`Missing audit coverage for: ${requiredEvents.filter(e => !eventTypes.has(e)).join(', ')}`);
    if (timelinessScore < 80) gaps.push('Alert response times exceed 48-hour target');
    if (integrityScore < 100) gaps.push(`${chainBreaks} chain integrity issues detected`);
    if (qualityScore < 60) gaps.push(`High false positive rate (${totalDecisions > 0 ? Math.round(fpCount / totalDecisions * 100) : 0}%)`);
    if (regulatoryScore < 100) gaps.push(`${breaches} investigation(s) exceed PMLA 7-day STR filing deadline`);

    res.json({
      overall_score: overall,
      components: {
        coverage: { score: coverageScore, detail: `${coveredEvents.length}/${requiredEvents.length} required event types logged` },
        timeliness: { score: timelinessScore, detail: 'Alert response time assessment' },
        integrity: { score: integrityScore, detail: `${chainBreaks} chain breaks detected out of ${allLogs.length} entries` },
        quality: { score: qualityScore, detail: `${totalDecisions} total decisions, ${totalDecisions > 0 ? Math.round(fpCount / totalDecisions * 100) : 0}% false positive rate` },
        regulatory: { score: regulatoryScore, detail: `${breaches} PMLA 7-day deadline breaches` }
      },
      gaps,
      total_entries: allLogs.length,
      computed_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Compliance score error:', err);
    res.status(500).json({ error: 'Failed to compute compliance score' });
  }
});

// ============================================================
// GET /api/audit/session/:actorId — Pillar 5: Session forensics
// ============================================================
router.get('/session/:actorId', authenticateToken, async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = 'SELECT * FROM audit_logs WHERE actor_id = $1';
    const params = [req.params.actorId];

    if (from) { params.push(from); query += ` AND timestamp >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND timestamp <= $${params.length}`; }
    query += ' ORDER BY timestamp ASC';

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return res.json({ sessions: [] });

    // Group into sessions (30min gap = new session)
    const SESSION_GAP_MS = 30 * 60 * 1000;
    const sessions = [];
    let current = { events: [rows[0]], start: rows[0].timestamp };

    for (let i = 1; i < rows.length; i++) {
      const gap = new Date(rows[i].timestamp) - new Date(rows[i - 1].timestamp);
      if (gap > SESSION_GAP_MS) {
        current.end = rows[i - 1].timestamp;
        current.duration_minutes = Math.round((new Date(current.end) - new Date(current.start)) / 60000);
        sessions.push(current);
        current = { events: [rows[i]], start: rows[i].timestamp };
      } else {
        current.events.push(rows[i]);
      }
    }
    current.end = rows[rows.length - 1].timestamp;
    current.duration_minutes = Math.round((new Date(current.end) - new Date(current.start)) / 60000);
    sessions.push(current);

    res.json({
      actor_id: req.params.actorId,
      total_sessions: sessions.length,
      total_events: rows.length,
      sessions
    });
  } catch (err) {
    console.error('Session forensics error:', err);
    res.status(500).json({ error: 'Failed to retrieve session data' });
  }
});

module.exports = router;
