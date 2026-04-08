// ============================================================
// auditService.js — Audit Logging with HMAC-SHA256 Integrity
// Uses Web Crypto API (built-in, no npm dependency needed)
// ============================================================

import { apiGet, apiPost, getToken } from '../apiClient';

const HMAC_SECRET = import.meta.env.VITE_AUDIT_HMAC_SECRET || 'gafa-audit-default-key';

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
