import { useState, useEffect, useCallback } from 'react';
import { fetchAuditLogs, verifyLogEntry } from '../services/auditService';
import './pages.css';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verificationMap, setVerificationMap] = useState({});
  const [eventFilter, setEventFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const EVENT_TYPES = [
    '', 'AUTH_LOGIN', 'AUTH_LOGOUT',
    'DATA_UPLOAD_CUSTOMER', 'DATA_UPLOAD_TRANSACTION',
    'CUSTOMER_VIEWED', 'SCREENING_RUN',
    'ALERT_CLOSED', 'ALERT_ESCALATED',
    'RULE_STATUS_CHANGED',
    'SAR_CLOSED_FALSE_POSITIVE', 'SAR_ESCALATED', 'SAR_DRAFT_SAR',
    'AML_PROCESSING_COMPLETE',
  ];

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({
        eventType: eventFilter || undefined,
        limit: 200,
      });
      setLogs(data || []);

      // Verify all entries in parallel
      const verResults = {};
      await Promise.all(
        (data || []).map(async (entry) => {
          const valid = await verifyLogEntry(entry);
          verResults[entry.id] = valid;
        })
      );
      setVerificationMap(verResults);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.event_type || '').toLowerCase().includes(term) ||
      (log.entity_type || '').toLowerCase().includes(term) ||
      (log.entity_id || '').toLowerCase().includes(term) ||
      (log.actor_role || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Audit Log
        </h1>
        <p>Immutable, HMAC-verified record of all system actions for compliance and accountability</p>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search audit logs"
          />
        </div>
        <select
          className="form-input"
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value)}
          style={{ maxWidth: '220px', fontSize: '0.75rem', padding: '0.5rem' }}
          aria-label="Filter by event type"
        >
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t || 'All Events'}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={loadLogs} style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}>
          Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="skeleton-table">
            <div className="skeleton-row header">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="skeleton-cell" key={i} style={{ width: `${12 + i * 4}%` }} />
              ))}
            </div>
            {Array.from({ length: 10 }).map((_, i) => (
              <div className="skeleton-row" key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <div className="skeleton-cell" key={j} style={{ width: `${12 + j * 4}%` }} />
                ))}
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h3>No audit logs found</h3>
            <p>Actions will be logged here as users interact with the platform.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Details</th>
                <th>Verified</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span className={`status-badge ${log.event_type?.startsWith('AUTH') ? 'open' : log.event_type?.startsWith('ALERT') || log.event_type?.startsWith('SAR') ? 'escalated' : 'closed'}`}>
                      {log.event_type}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{log.actor_role}</span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                    {log.entity_type ? `${log.entity_type}:${log.entity_id || ''}` : '—'}
                  </td>
                  <td className="audit-meta" title={JSON.stringify(log.metadata)}>
                    {log.metadata ? JSON.stringify(log.metadata).substring(0, 60) : '—'}
                  </td>
                  <td>
                    {verificationMap[log.id] === true ? (
                      <span className="audit-verified">✓</span>
                    ) : verificationMap[log.id] === false ? (
                      <span className="audit-failed">✗</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
