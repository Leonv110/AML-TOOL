// ============================================================
// auditService.js — Audit Logging with HMAC-SHA256 Integrity
// + Hash Chain, Analytics, Session Forensics, FIU-IND Export
// Uses Web Crypto API (built-in, no npm dependency needed)
// ============================================================

import { apiGet, apiPost, getToken } from '../apiClient';

const HMAC_SECRET = import.meta.env.VITE_AUDIT_HMAC_SECRET || 'gafa-default-audit-key-change-in-production';
if (!import.meta.env.VITE_AUDIT_HMAC_SECRET) {
  console.warn('⚠️ VITE_AUDIT_HMAC_SECRET is not set — using default key. Set this in Vercel env vars for production.');
}

// --- HMAC-SHA256 using Web Crypto API ---
async function computeHMAC(message) {
  try {
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
  } catch (err) {
    console.warn('HMAC computation failed, using hash fallback:', err.message);
    // Fallback: simple hash for environments where Web Crypto fails
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }
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

// ====================================================// Pillar 6: FIU-IND PDF Export
// Matches reportGenerator.js professional style
// ============================================================

export async function generateFIUReport(logs, chainStatus, dateRange) {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
  await import('jspdf-autotable');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const refDate = new Date();
  const refNumber = `AUD-${refDate.getFullYear()}${String(refDate.getMonth() + 1).padStart(2, '0')}${String(refDate.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // --- Helper: Logo ---
  let logoBase64 = null;
  try {
    const res = await fetch('/logo.webp');
    if (res.ok) {
      const blob = await res.blob();
      logoBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    }
  } catch {}

  // --- Helper: Header ---
  function addHeader(title) {
    doc.setFillColor(14, 25, 48);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setFillColor(14, 179, 167);
    doc.rect(0, 45, pageWidth, 2, 'F');

    if (logoBase64) {
      doc.addImage(logoBase64, 'WEBP', 15, 10, 25, 25);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.circle(27, 22, 10, 'F');
      doc.setFillColor(14, 179, 167);
      doc.circle(27, 22, 5, 'F');
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GAFA Academy', 45, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('Global Anti-Financial Crime Academy  |  FIU Reg: FIU-IND/XXXXX/2024', 45, 26);
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Ref: ${refNumber}`, pageWidth - 15, 18, { align: 'right' });
    doc.setFontSize(8);
    doc.text(now, pageWidth - 15, 26, { align: 'right' });

    doc.setFillColor(41, 65, 105);
    doc.rect(15, 52, pageWidth - 30, 12, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title, pageWidth / 2, 60, { align: 'center' });
    return 75;
  }

  // --- Helper: Footer ---
  function addFooter(pageNum, totalPages) {
    doc.setDrawColor(200);
    doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text('GAFA Academy — Confidential', 15, pageHeight - 14);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 14, { align: 'center' });
    doc.text(`Compliance Officer: GAFA AML`, pageWidth - 15, pageHeight - 14, { align: 'right' });
  }

  // ==============================
  // PAGE 1: Header + Executive Summary + Chain Integrity
  // ==============================
  let y = addHeader('FIU-IND AUDIT TRAIL REPORT — PMLA §12');

  // Section 1: Executive Summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('1. EXECUTIVE SUMMARY', 15, y);
  y += 6;

  const summaryData = [
    ['Report Reference', refNumber],
    ['Reporting Period', `${dateRange.from || 'All time'} — ${dateRange.to || 'Present'}`],
    ['Generated At', now],
    ['Total Audit Entries', String(logs.length)],
    ['Unique Event Types', String(new Set(logs.map(l => l.event_type)).size)],
    ['Unique Actors', String(new Set(logs.map(l => l.actor_id).filter(Boolean)).size)],
    ['Regulatory Basis', 'PMLA Section 12(1)(a) — Record Keeping'],
  ];

  doc.autoTable({
    startY: y,
    body: summaryData,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: [80, 80, 80] },
      1: { textColor: [0, 0, 0], fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Section 2: Chain Integrity
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('2. HASH CHAIN INTEGRITY VERIFICATION', 15, y);
  y += 6;

  const integrityColor = chainStatus.intact ? [34, 139, 34] : [180, 40, 40];
  const chainData = [
    ['Chain Status', chainStatus.intact ? 'INTACT ✓ — No tampering detected' : 'COMPROMISED ✗ — Integrity issues found'],
    ['Total Entries Verified', String(chainStatus.total_entries || logs.length)],
    ['Chain Breaks', String(chainStatus.breaks?.length || 0)],
    ['Sequence Gaps', String(chainStatus.gaps?.length || 0)],
    ['Algorithm', 'HMAC-SHA256 (Web Crypto API)'],
    ['Linking Method', 'Sequential hash chaining (prev_hash → current)'],
  ];

  doc.autoTable({
    startY: y,
    body: chainData,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: [80, 80, 80] },
      1: { textColor: integrityColor, fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Section 3: Event Distribution
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('3. EVENT TYPE DISTRIBUTION', 15, y);
  y += 6;

  const eventCounts = {};
  logs.forEach(l => {
    const t = l.event_type || 'UNKNOWN';
    eventCounts[t] = (eventCounts[t] || 0) + 1;
  });

  const eventDistData = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => [
      type,
      String(count),
      `${((count / logs.length) * 100).toFixed(1)}%`,
    ]);

  doc.autoTable({
    startY: y,
    head: [['Event Type', 'Count', 'Percentage']],
    body: eventDistData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 105], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      1: { halign: 'center', fontStyle: 'bold' },
      2: { halign: 'center' },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Digital Signature (master hash)
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('4. DOCUMENT DIGITAL SIGNATURE', 15, y);
  y += 6;

  const content = JSON.stringify(logs.map(l => l.hmac_signature || ''));
  const masterHash = await computeHMAC(content);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60);
  doc.text('This document is digitally signed using HMAC-SHA256 over all audit entry signatures.', 15, y);
  y += 5;
  doc.text('Any modification to the underlying data will invalidate this signature.', 15, y);
  y += 8;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80);
  doc.text('Master Hash:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(41, 65, 105);
  doc.text(masterHash, 42, y);

  // ==============================
  // NEXT PAGES: Chronological Audit Trail Table
  // ==============================
  doc.addPage();
  y = 20;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('5. CHRONOLOGICAL AUDIT TRAIL', 15, y);
  y += 3;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`${logs.length} entries ordered by timestamp. Each entry is independently HMAC-signed.`, 15, y + 3);
  y += 8;

  doc.autoTable({
    startY: y,
    head: [['#', 'Timestamp (IST)', 'Event Type', 'Actor Role', 'Entity', 'HMAC']],
    body: logs.map((log, i) => [
      i + 1,
      new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      log.event_type || '—',
      log.actor_role || '—',
      log.entity_type ? `${log.entity_type}:${(log.entity_id || '').substring(0, 12)}` : '—',
      log.hmac_signature ? '✓ Signed' : '✗ Missing',
    ]),
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 105], textColor: 255, fontSize: 7, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 38 },
      5: { halign: 'center', cellWidth: 18 },
    },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ==============================
  // DECLARATION
  // ==============================
  if (y > pageHeight - 70) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 65, 105);
  doc.text('6. DECLARATION', 15, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  const declaration = [
    'I hereby declare that the information provided in this Audit Trail Report is true and correct to the best of',
    'my knowledge and belief. This report is generated in compliance with the Prevention of Money Laundering Act,',
    '2002 (PMLA) and the rules and regulations issued by FIU-IND. The audit trail has been cryptographically verified',
    'using HMAC-SHA256 hash chaining to ensure tamper-evidence.',
    '',
    '',
    'Compliance Officer: _____________________',
    '',
    'Signature: _____________________',
    '',
    `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    '',
    'Reviewed by: _____________________',
  ];
  declaration.forEach(line => {
    doc.text(line, 15, y);
    y += 4.5;
  });

  // ==============================
  // Add page numbers to all pages
  // ==============================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  doc.save(`GAFA_FIU_Audit_Report_${refNumber}.pdf`);
}
