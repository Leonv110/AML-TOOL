import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { fetchAlerts, updateAlertStatus, fetchCustomerById, fetchTransactionsForCustomer } from '../services/dataService';
import { buildPayload, callGemini } from '../services/aiService';
import './pages.css';

export default function AlertReview() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [aiResults, setAiResults] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await fetchAlerts(statusFilter || undefined);
      setAlerts(data);
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(alert, newStatus) {
    try {
      if (newStatus === 'escalated') {
        const { data: user } = await supabase.auth.getUser();
        const { data: investigation } = await supabase
          .from('investigations')
          .insert({
            case_id: `CASE-${Date.now()}`,
            customer_id: alert.customer_id,
            customer_name: alert.customer_name || alert.customer_id,
            risk_level: alert.risk_level,
            alert_type: alert.rule_triggered,
            status: 'escalated',
            assigned_to: user?.user?.id
          })
          .select()
          .single();

        await updateAlertStatus(alert.alert_id, 'escalated', investigation?.case_id);
      } else {
        await updateAlertStatus(alert.alert_id, newStatus);
      }
      setAlerts(prev => prev.map(a => a.alert_id === alert.alert_id ? { ...a, status: newStatus } : a));
    } catch (err) {
      // Handle silently
    }
  }

  async function handleGenerateAI(alert) {
    setAiLoading(prev => ({ ...prev, [alert.alert_id]: true }));
    try {
      const customer = await fetchCustomerById(alert.customer_id);
      const transactions = await fetchTransactionsForCustomer(alert.customer_id);
      const payload = buildPayload(customer || {}, transactions, alert.rule_triggered);
      const result = await callGemini(payload);
      setAiResults(prev => ({ ...prev, [alert.alert_id]: result }));
    } catch (err) {
      setAiResults(prev => ({ ...prev, [alert.alert_id]: { error: err.message } }));
    } finally {
      setAiLoading(prev => ({ ...prev, [alert.alert_id]: false }));
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Alert Review
        </h1>
        <p>Investigate and disposition system-generated compliance alerts</p>
      </div>

      {/* Status Filter */}
      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        {['', 'open', 'closed', 'escalated'].map(f => (
          <button
            key={f}
            className={`btn ${statusFilter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(f)}
            style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner-sm" />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            </svg>
            <h3>No alerts found</h3>
            <p>{statusFilter ? `No ${statusFilter} alerts. Try a different filter.` : 'Alerts will appear here once transactions are monitored and flagged.'}</p>
          </div>
        ) : (
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Customer</th>
                  <th>Risk Level</th>
                  <th>Rule Triggered</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <React.Fragment key={alert.alert_id || alert.id}>
                    <tr
                      className="clickable-row"
                      onClick={() => {
                        if (alert.customer_id) navigate(`/customers/${alert.customer_id}`);
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Alert ${alert.alert_id}`}
                    >
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{alert.alert_id}</td>
                      <td className="name-cell">{alert.customer_name || alert.customer_id}</td>
                      <td>
                        <span className={`risk-badge ${(alert.risk_level || '').toLowerCase()}`}>
                          {alert.risk_level || 'N/A'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>{alert.rule_triggered || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${(alert.status || 'open').toLowerCase()}`}>
                          {alert.status || 'open'}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {alert.status === 'open' && (
                            <>
                              <button className="btn btn-success" style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}
                                onClick={() => handleStatusChange(alert, 'closed')} aria-label="Close alert">
                                Close
                              </button>
                              <button className="btn btn-danger" style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem' }}
                                onClick={() => handleStatusChange(alert, 'escalated')} aria-label="Escalate alert">
                                Escalate
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.65rem', padding: '0.25rem 0.5rem', color: '#a78bfa', borderColor: 'rgba(167, 139, 250, 0.3)' }}
                            onClick={() => handleGenerateAI(alert)}
                            disabled={aiLoading[alert.alert_id]}
                            aria-label="Generate AI Pattern Summary"
                          >
                            {aiLoading[alert.alert_id] ? '...' : '✨ AI Summary'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* AI Summary Panel */}
                    {aiResults[alert.alert_id] && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <div className="ai-summary-panel" style={{ margin: '0 1rem 0.75rem' }}>
                            {aiResults[alert.alert_id].error ? (
                              <div className="error-banner" style={{ margin: 0 }}>{aiResults[alert.alert_id].error}</div>
                            ) : (
                              <>
                                <h4>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                  </svg>
                                  AI Pattern Analysis
                                </h4>
                                {aiResults[alert.alert_id].sections?.map((section, i) => (
                                  <div key={i} style={{ marginBottom: '0.75rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c4b5fd', marginBottom: '0.25rem' }}>
                                      {section.title}
                                    </div>
                                    <ul>
                                      {section.points.map((point, j) => (
                                        <li key={j}>{point}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                                <div className="ai-disclaimer">
                                  {aiResults[alert.alert_id].disclaimer}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
