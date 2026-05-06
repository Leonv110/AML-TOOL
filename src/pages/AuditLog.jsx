import { useState, useEffect, useCallback } from 'react';
import {
  fetchAuditLogs, verifyLogEntry, fetchChainStatus, fetchChainExport,
  fetchRuleEffectiveness, fetchAnalystBehavior, fetchComplianceScore,
  fetchSessionTimeline, generateFIUReport
} from '../services/auditService';
import { useAuth } from '../contexts/AuthContext';
import './pages.css';
import './AuditLog.css';

const TABS = [
  { id: 'logs', label: 'Event Log', icon: '📋' },
  { id: 'rules', label: 'Rule Intelligence', icon: '📊' },
  { id: 'analysts', label: 'Analyst Monitor', icon: '🕵️' },
  { id: 'compliance', label: 'Compliance', icon: '🏥' },
  { id: 'forensics', label: 'Forensics', icon: '⏱️' },
];

const EVENT_TYPES = [
  '', 'AUTH_LOGIN', 'AUTH_LOGOUT', 'DATA_UPLOAD_CUSTOMER', 'DATA_UPLOAD_TRANSACTION',
  'CUSTOMER_VIEWED', 'SCREENING_RUN', 'ALERT_CLOSED', 'ALERT_ESCALATED',
  'RULE_STATUS_CHANGED', 'SAR_CLOSED_FALSE_POSITIVE', 'SAR_ESCALATED', 'SAR_DRAFT_SAR',
  'AML_PROCESSING_COMPLETE',
];

export default function AuditLog() {
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verificationMap, setVerificationMap] = useState({});
  const [eventFilter, setEventFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [chainStatus, setChainStatus] = useState(null);
  const [ruleData, setRuleData] = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [sessionActorId, setSessionActorId] = useState('');
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs({ eventType: eventFilter || undefined, limit: 200 });
      setLogs(data || []);
      const verResults = {};
      await Promise.all((data || []).map(async (entry) => {
        verResults[entry.id] = await verifyLogEntry(entry);
      }));
      setVerificationMap(verResults);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [eventFilter]);

  const loadChain = useCallback(async () => {
    const status = await fetchChainStatus();
    setChainStatus(status);
  }, []);

  useEffect(() => { loadLogs(); loadChain(); }, [loadLogs, loadChain]);

  useEffect(() => {
    if (activeTab === 'rules') fetchRuleEffectiveness().then(setRuleData);
    if (activeTab === 'analysts') fetchAnalystBehavior().then(setAnalysts);
    if (activeTab === 'compliance') fetchComplianceScore().then(setCompliance);
  }, [activeTab]);

  const handleExportJSON = async () => {
    const data = await fetchChainExport();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `GAFA_Audit_Chain_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    if (!logs || logs.length === 0) {
      alert('No audit logs to export. Ensure logs are loaded first.');
      return;
    }
    setExportingPDF(true);
    try {
      await generateFIUReport(logs, chainStatus || { intact: true, breaks: [], gaps: [] }, { from: null, to: null });
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert(`PDF export failed: ${err.message}`);
    } finally { setExportingPDF(false); }
  };

  const handleLoadSession = async () => {
    if (!sessionActorId) return;
    const data = await fetchSessionTimeline(sessionActorId);
    setSessionData(data);
  };

  const filtered = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (log.event_type || '').toLowerCase().includes(term) ||
      (log.entity_type || '').toLowerCase().includes(term) ||
      (log.entity_id || '').toLowerCase().includes(term) ||
      (log.actor_role || '').toLowerCase().includes(term);
  });

  const getEventClass = (type) => {
    if (type?.startsWith('AUTH')) return 'auth';
    if (type?.startsWith('ALERT') || type?.startsWith('SAR')) return 'alert';
    if (type?.includes('CUSTOMER') || type?.includes('SCREENING')) return 'view';
    return '';
  };

  const getScoreColor = (score) => score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Adaptive Audit Intelligence
        </h1>
        <p>Tamper-evident, HMAC-verified audit trail with adaptive analytics for financial risk control</p>
      </div>

      {/* Chain Integrity Banner — Pillar 1 */}
      {chainStatus && (
        <div className={`chain-banner ${chainStatus.intact ? 'intact' : 'compromised'}`}>
          <div className="chain-icon">
            {chainStatus.intact ? '🔗 ✓' : '⛓️‍💥 ✗'}
            <span>{chainStatus.intact ? 'Hash Chain Intact' : 'Chain Compromised'}</span>
          </div>
          <div className="chain-detail">
            {chainStatus.total_entries} entries verified
            {chainStatus.breaks?.length > 0 && ` · ${chainStatus.breaks.length} break(s)`}
            {chainStatus.gaps?.length > 0 && ` · ${chainStatus.gaps.length} gap(s)`}
          </div>
          <div className="export-actions">
            <button className="btn btn-secondary" onClick={handleExportJSON} style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>
              ⬇ Signed JSON
            </button>
            <button className="btn btn-secondary" onClick={handleExportPDF} disabled={exportingPDF}
              style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', color: '#a78bfa', borderColor: 'rgba(167,139,250,0.3)' }}>
              {exportingPDF ? '⏳ Generating...' : '📄 FIU-IND PDF'}
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs">
        {TABS.map(tab => (
          (tab.id !== 'analysts' || userRole === 'admin') && (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.icon} {tab.label}
            </button>
          )
        ))}
      </div>

      {/* TAB 1: Event Log */}
      {activeTab === 'logs' && (
        <div className="card">
          <div className="filter-bar" style={{ marginBottom: '1rem' }}>
            <div className="search-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input type="text" placeholder="Search events..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} aria-label="Search audit logs" />
            </div>
            <select className="form-input" value={eventFilter} onChange={e => setEventFilter(e.target.value)}
              style={{ maxWidth: '220px', fontSize: '0.75rem', padding: '0.5rem' }} aria-label="Filter by event type">
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t || 'All Events'}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={loadLogs} style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}>Refresh</button>
          </div>
          {loading ? (
            <div className="skeleton-table">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="skeleton-row" key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div className="skeleton-cell" key={j} style={{ width: `${12 + j * 4}%` }} />
                  ))}
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              <h3>No audit logs found</h3><p>Actions will be logged here as users interact with the platform.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Timestamp</th><th>Event Type</th><th>Actor</th><th>Entity</th><th>Details</th><th>Verified</th></tr></thead>
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
                    <td style={{ fontSize: '0.75rem' }}><span style={{ color: 'var(--text-muted)' }}>{log.actor_role}</span></td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                      {log.entity_type ? `${log.entity_type}:${log.entity_id || ''}` : '—'}
                    </td>
                    <td className="audit-meta" title={JSON.stringify(log.metadata)}>
                      {log.metadata ? JSON.stringify(log.metadata).substring(0, 60) : '—'}
                    </td>
                    <td>
                      {verificationMap[log.id] === true ? <span className="audit-verified">✓</span>
                        : verificationMap[log.id] === false ? <span className="audit-failed">✗</span>
                        : <span style={{ color: 'var(--text-muted)' }}>…</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: Rule Intelligence — Pillar 2 */}
      {activeTab === 'rules' && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>📊 Rule Effectiveness (Audit-Driven Intelligence)</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Precision scores computed from analyst decisions captured in the audit trail. Rules with low precision generate excessive false positives and should be reviewed.
          </p>
          {ruleData.length === 0 ? (
            <div className="empty-state"><h3>No decision data yet</h3><p>As analysts review alerts, rule effectiveness will be computed from their decisions.</p></div>
          ) : (
            <table className="data-table rule-eff-table">
              <thead><tr><th>Rule</th><th>Alerts</th><th>Escalated</th><th>False Pos.</th><th>Precision</th><th>Trend (7d)</th><th>Status</th></tr></thead>
              <tbody>
                {ruleData.map(rule => (
                  <tr key={rule.rule_name}>
                    <td className="name-cell">{rule.rule_name}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{rule.total_alerts}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#22c55e' }}>{rule.escalated}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#ef4444' }}>{rule.false_positive}</td>
                    <td>
                      <div className="precision-bar">
                        <div className="precision-bar-track">
                          <div className="precision-bar-fill" style={{
                            width: `${rule.precision_score ?? 0}%`,
                            background: rule.precision_score >= 80 ? '#22c55e' : rule.precision_score >= 50 ? '#f59e0b' : '#ef4444'
                          }} />
                        </div>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', fontWeight: 700,
                          color: rule.precision_score >= 80 ? '#22c55e' : rule.precision_score >= 50 ? '#f59e0b' : '#ef4444' }}>
                          {rule.precision_score !== null ? `${rule.precision_score}%` : '—'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`trend-indicator ${rule.trend_7d}`}>
                        {rule.trend_7d === 'improving' ? '↑' : rule.trend_7d === 'degrading' ? '↓' : '→'} {rule.trend_7d}
                      </span>
                    </td>
                    <td>
                      <span className={`recommendation-badge ${
                        rule.recommendation.startsWith('Critical') ? 'critical' :
                        rule.recommendation.startsWith('Monitor') ? 'monitor' :
                        rule.recommendation === 'Acceptable' ? 'acceptable' : 'optimal'}`}>
                        {rule.recommendation.split('—')[0].trim()}
                      </span>
                      {rule.suggested_action && <div className="suggested-action">💡 {rule.suggested_action}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: Analyst Monitor — Pillar 3 (admin only) */}
      {activeTab === 'analysts' && userRole === 'admin' && (
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>🕵️ Analyst Behavioral Analysis</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Session-level anomaly detection. Flags rubber-stamping, bulk data access, one-directional decisions, and off-hours activity.
          </p>
          {analysts.length === 0 ? (
            <div className="card"><div className="empty-state"><h3>No analyst data</h3><p>Activity data will appear once analysts begin reviewing alerts.</p></div></div>
          ) : (
            <div className="analyst-grid">
              {analysts.map(a => (
                <div key={a.actor_id} className={`analyst-card risk-${a.risk_level}`}>
                  <div className="analyst-card-header">
                    <h4>{a.actor_id.substring(0, 8)}…</h4>
                    <span className={`risk-badge ${a.risk_level}`}>{a.risk_level}</span>
                  </div>
                  <div className="analyst-metrics">
                    <div className="analyst-metric"><span className="metric-label">Sessions</span><span className="metric-value">{a.total_sessions}</span></div>
                    <div className="analyst-metric"><span className="metric-label">Events</span><span className="metric-value">{a.total_events}</span></div>
                    <div className="analyst-metric"><span className="metric-label">FP Rate</span>
                      <span className="metric-value" style={{ color: a.false_positive_rate > 70 ? '#ef4444' : a.false_positive_rate > 40 ? '#f59e0b' : '#22c55e' }}>
                        {a.false_positive_rate !== null ? `${a.false_positive_rate}%` : '—'}
                      </span>
                    </div>
                    <div className="analyst-metric"><span className="metric-label">Customers</span><span className="metric-value">{a.total_customers_viewed}</span></div>
                  </div>
                  {a.anomalies.length > 0 && (
                    <div className="anomaly-list">
                      {a.anomalies.map((an, i) => (
                        <div key={i} className={`anomaly-tag ${an.severity}`}>
                          {an.severity === 'high' ? '🔴' : an.severity === 'medium' ? '🟡' : '⚪'} {an.type.replace(/_/g, ' ')}
                          <span style={{ fontWeight: 400, marginLeft: '0.25rem', opacity: 0.8 }}>— {an.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.anomalies.length === 0 && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>✓ No anomalies detected</div>}
                  <button className="btn btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.65rem', padding: '0.25rem 0.5rem', width: '100%' }}
                    onClick={() => { setSessionActorId(a.actor_id); setActiveTab('forensics'); }}>
                    View Session Timeline →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Compliance — Pillar 4 */}
      {activeTab === 'compliance' && (
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>🏥 Compliance Health Score</div>
          {!compliance ? (
            <div className="loading-state"><div className="loading-spinner-sm" /><p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Computing compliance metrics...</p></div>
          ) : (
            <>
              <div className="compliance-gauge">
                <div className="gauge-ring">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                    <circle cx="70" cy="70" r="58" fill="none" stroke={getScoreColor(compliance.overall_score)}
                      strokeWidth="10" strokeDasharray={`${(compliance.overall_score / 100) * 364.4} 364.4`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="gauge-label">
                    <div className="gauge-score" style={{ color: getScoreColor(compliance.overall_score) }}>{compliance.overall_score}</div>
                    <div className="gauge-sub">/ 100</div>
                  </div>
                </div>
                <div className="compliance-bars">
                  {Object.entries(compliance.components).map(([key, val]) => (
                    <div key={key} className="compliance-bar-row">
                      <div className="compliance-bar-label">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                      <div className="compliance-bar-track">
                        <div className="compliance-bar-fill" style={{ width: `${val.score}%`, background: getScoreColor(val.score) }} />
                      </div>
                      <div className="compliance-bar-value" style={{ color: getScoreColor(val.score) }}>{val.score}%</div>
                    </div>
                  ))}
                </div>
              </div>
              {compliance.gaps?.length > 0 && (
                <div className="compliance-gaps">
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>⚠ Identified Gaps</div>
                  {compliance.gaps.map((gap, i) => (
                    <div key={i} className="compliance-gap-item">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {gap}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Computed at {new Date(compliance.computed_at).toLocaleString()} · {compliance.total_entries} audit entries analyzed
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: Forensics — Pillar 5 */}
      {activeTab === 'forensics' && (
        <div>
          <div className="session-controls">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="session-actor">Actor ID (UUID)</label>
              <input id="session-actor" className="form-input" type="text" placeholder="Paste actor UUID..."
                value={sessionActorId} onChange={e => setSessionActorId(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleLoadSession} disabled={!sessionActorId}
              style={{ alignSelf: 'flex-end' }}>Load Sessions</button>
          </div>

          {!sessionData ? (
            <div className="card">
              <div className="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                <h3>Session Forensics</h3>
                <p>Enter an actor UUID to reconstruct their complete activity timeline from audit entries.</p>
                {analysts.length > 0 && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Known actors: {analysts.map(a => (
                      <button key={a.actor_id} className="btn btn-secondary" style={{ fontSize: '0.6rem', padding: '0.15rem 0.4rem', margin: '0.15rem' }}
                        onClick={() => setSessionActorId(a.actor_id)}>{a.actor_id.substring(0, 8)}…</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : sessionData.sessions?.length === 0 ? (
            <div className="card"><div className="empty-state"><h3>No sessions found</h3><p>No audit entries exist for this actor.</p></div></div>
          ) : (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {sessionData.total_sessions} session(s) · {sessionData.total_events} total events
              </div>
              {sessionData.sessions.map((session, si) => (
                <div key={si} className="session-block">
                  <div className="session-header">
                    <strong>Session {si + 1}</strong>
                    <span>{new Date(session.start).toLocaleString()} — {session.duration_minutes} min · {session.events.length} events</span>
                  </div>
                  <div className="forensic-timeline">
                    {session.events.map((evt, ei) => {
                      const evtKey = `${si}-${ei}`;
                      const isExpanded = expandedEvent === evtKey;
                      return (
                        <div key={ei} className={`forensic-event ${getEventClass(evt.event_type)}`}
                          onClick={() => setExpandedEvent(isExpanded ? null : evtKey)}>
                          <span className="event-time">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <div className="event-body">
                            <div className="event-type-label">
                              {evt.event_type === 'AUTH_LOGIN' ? '🔑' : evt.event_type === 'AUTH_LOGOUT' ? '🚪' :
                               evt.event_type === 'CUSTOMER_VIEWED' ? '👤' : evt.event_type === 'SCREENING_RUN' ? '🔍' :
                               evt.event_type?.startsWith('ALERT') ? '⚠️' : evt.event_type?.startsWith('SAR') ? '📝' : '📌'}
                              {' '}{evt.event_type}
                            </div>
                            {evt.entity_type && <div className="event-entity">{evt.entity_type}:{evt.entity_id || ''}</div>}
                            {isExpanded && evt.metadata && (
                              <div className="event-metadata-expand">
                                {JSON.stringify(typeof evt.metadata === 'string' ? JSON.parse(evt.metadata) : evt.metadata, null, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
