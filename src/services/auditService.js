// ============================================================
// auditService.js — Audit Logging with HMAC-SHA256 Integrity
// + Hash Chain, Analytics, Session Forensics, FIU-IND Export
// Uses Web Crypto API (built-in, no npm dependency needed)
// ============================================================

import { apiGet, apiPost, getToken } from '../apiClient';

const HMAC_SECRET = import.meta.env.VITE_AUDIT_HMAC_SECRET;
if (!HMAC_SECRET) {
  console.warn('⚠️ VITE_AUDIT_HMAC_SECRET is not set — audit log integrity verification will be weakened');
}

// --- HMAC-SHA256 using Web Crypto API ---
async function computeHMAC(message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(HMAC_SECRET);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Extract user info from JWT token (without library) ---
function parseJWT(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
}

// --- Log an audit event (fire-and-forget) ---
export async function logEvent(eventType, entityType, entityId, metadata = {}) {
  try {
    const token = getToken();
    const jwt = token ? parseJWT(token) : {};
    const actorId = jwt.id || jwt.sub || null;
    const actorRole = jwt.role || 'unknown';
    const timestamp = new Date().toISOString();

    // Build the canonical string for HMAC
    const canonical = JSON.stringify({
      event_type: eventType,
      actor_id: actorId,
      actor_role: actorRole,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      timestamp,
    });

    const hmac_signature = await computeHMAC(canonical);

    // Fire-and-forget — don't await, don't crash the app
    apiPost('/api/audit', {
      event_type: eventType,
      actor_id: actorId,
      actor_role: actorRole,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      timestamp,
      hmac_signature,
    }).catch(() => {
      // Silently fail — audit logging must never crash the main app
    });
  } catch {
    // Silently fail
  }
}

// --- Verify a log entry's HMAC ---
export async function verifyLogEntry(entry) {
  try {
    const canonical = JSON.stringify({
      event_type: entry.event_type,
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      metadata: entry.metadata,
      timestamp: entry.timestamp,
    });

    const expected = await computeHMAC(canonical);
    return expected === entry.hmac_signature;
  } catch {
    return false;
  }
}

// --- Fetch audit logs with filters ---
export async function fetchAuditLogs(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.eventType) params.set('event_type', filters.eventType);
    if (filters.actorId) params.set('actor_id', filters.actorId);
    if (filters.limit) params.set('limit', filters.limit);

    const qs = params.toString();
    return await apiGet(`/api/audit${qs ? `?${qs}` : ''}`);
  } catch {
    return [];
  }
}

// ============================================================
// Pillar 1: Hash Chain Functions
// ============================================================

export async function fetchChainStatus() {
  try {
    return await apiGet('/api/audit/chain/verify');
  } catch {
    return { intact: false, total_entries: 0, breaks: [], gaps: [], error: true };
  }
}

export async function fetchChainExport(from, to) {
  try {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return await apiGet(`/api/audit/chain/export${qs ? `?${qs}` : ''}`);
  } catch {
    return null;
  }
}

// ============================================================
// Pillar 2: Rule Effectiveness
// ============================================================

export async function fetchRuleEffectiveness() {
  try {
    return await apiGet('/api/audit/analytics/rule-effectiveness');
  } catch {
    return [];
  }
}

// ============================================================
// Pillar 3: Analyst Behavior
// ============================================================

export async function fetchAnalystBehavior() {
  try {
    return await apiGet('/api/audit/analytics/analyst-behavior');
  } catch {
    return [];
  }
}

// ============================================================
// Pillar 4: Compliance Score
// ============================================================

export async function fetchComplianceScore() {
  try {
    return await apiGet('/api/audit/analytics/compliance-score');
  } catch {
    return { overall_score: 0, components: {}, gaps: [] };
  }
}

// ============================================================
// Pillar 5: Session Forensics
// ============================================================

export async function fetchSessionTimeline(actorId, from, to) {
  try {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return await apiGet(`/api/audit/session/${actorId}${qs ? `?${qs}` : ''}`);
  } catch {
    return { sessions: [] };
  }
}

// ============================================================
// Pillar 6: FIU-IND PDF Export
// ============================================================

export async function generateFIUReport(logs, chainStatus, dateRange) {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // --- Cover Page ---
  doc.setFillColor(13, 17, 23);
  doc.rect(0, 0, pageWidth, 297, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFontSize(28);
  doc.text('GAFA AML Platform', pageWidth / 2, 60, { align: 'center' });

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(16);
  doc.text('Audit Trail Report', pageWidth / 2, 75, { align: 'center' });
  doc.setFontSize(11);
  doc.text('For FIU-IND Submission under PMLA Section 12', pageWidth / 2, 85, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  const coverInfo = [
    `Institution: GAFA AML Training Platform`,
    `Report Period: ${dateRange.from || 'All time'} — ${dateRange.to || 'Present'}`,
    `Generated At: ${now}`,
    `Total Entries: ${logs.length}`,
    `Chain Integrity: ${chainStatus.intact ? 'INTACT ✓' : 'COMPROMISED ✗'}`,
    `Chain Breaks: ${chainStatus.breaks?.length || 0}`,
    `Sequence Gaps: ${chainStatus.gaps?.length || 0}`,
  ];
  coverInfo.forEach((line, i) => doc.text(line, pageWidth / 2, 110 + i * 8, { align: 'center' }));

  // Master hash
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const content = JSON.stringify(logs.map(l => l.hmac_signature));
  const masterHash = await computeHMAC(content);
  doc.text(`Document Digital Signature (HMAC-SHA256):`, pageWidth / 2, 200, { align: 'center' });
  doc.text(masterHash, pageWidth / 2, 207, { align: 'center' });

  // --- Event Table Pages ---
  doc.addPage();
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(14);
  doc.text('Chronological Audit Trail', 14, 20);

  doc.autoTable({
    startY: 28,
    head: [['#', 'Timestamp', 'Event Type', 'Actor', 'Entity', 'HMAC Status']],
    body: logs.map((log, i) => [
      i + 1,
      new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      log.event_type,
      log.actor_role || '—',
      log.entity_type ? `${log.entity_type}:${log.entity_id || ''}` : '—',
      log.hmac_signature ? '✓ Signed' : '✗ Missing'
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: [200, 200, 200], fillColor: [13, 17, 23], lineColor: [40, 40, 50] },
    headStyles: { fillColor: [30, 35, 50], textColor: [245, 158, 11], fontSize: 7 },
    alternateRowStyles: { fillColor: [18, 22, 30] },
  });

  doc.save(`GAFA_Audit_Report_${new Date().toISOString().split('T')[0]}.pdf`);
}
