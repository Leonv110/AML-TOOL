import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchInvestigationByCaseId, fetchCustomerById, fetchTransactionsForCustomer,
  computeRiskScore, updateInvestigation
} from '../services/dataService';
import { screenCustomer } from '../services/screeningService';
import './pages.css';

export default function InvestigationWorkspace() {
  const { case_id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [investigation, setInvestigation] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [risk, setRisk] = useState(null);
  const [screening, setScreening] = useState(null);
  const [loading, setLoading] = useState(true);

  // Analyst inputs
  const [summary, setSummary] = useState('');
  const [justification, setJustification] = useState('');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);

  // SAR draft form
  const [showSarForm, setShowSarForm] = useState(false);
  const [sarData, setSarData] = useState({ description: '', evidence: '', recommendation: '' });

  useEffect(() => {
    loadWorkspace();
  }, [case_id]);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const inv = await fetchInvestigationByCaseId(case_id);
      if (!inv) { setLoading(false); return; }
      setInvestigation(inv);
      setSummary(inv.investigation_notes || '');

      const cust = await fetchCustomerById(inv.customer_id);
      setCustomer(cust);

      if (cust) {
        const txns = await fetchTransactionsForCustomer(cust.customer_id);
        setTransactions(txns);
        setRisk(computeRiskScore(cust, txns));
        const scr = await screenCustomer(cust.name, cust.date_of_birth, cust.country);
        setScreening(scr);
      }
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(status) {
    setSaving(true);
    try {
      const updates = {
        status,
        investigation_notes: summary,
        decision: `${status} — Justification: ${justification}. Evidence: ${evidence}`,
      };
      await updateInvestigation(investigation.id, updates);
      setInvestigation(prev => ({ ...prev, ...updates }));

      if (status === 'draft_sar') {
        setShowSarForm(true);
      }
    } catch (err) {
      // Handle silently
    } finally {
      setSaving(false);
    }
  }

  function exportMaltego() {
    const headers = 'From,To,Amount,Transaction_Type,Date,Risk_Level';
    const rows = transactions.map(tx =>
      `${tx.customer_id || ''},${tx.destination_id || tx.account_number || ''},${tx.amount || 0},${tx.transaction_type || ''},${tx.transaction_date || ''},${tx.country_risk_level || ''}`
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.download = `GAFA_Maltego_Export_${customer?.customer_id || 'unknown'}_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="loading-spinner-sm" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading investigation...</p>
        </div>
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Investigation not found</h3>
          <p>No investigation case found with ID: {case_id}</p>
        </div>
      </div>
    );
  }

  const tierClass = risk ? risk.tier.toLowerCase() : 'low';
  // Build counterparty list
  const counterparties = [...new Set(transactions
    .map(t => t.destination_id || t.account_number)
    .filter(Boolean)
  )];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Investigation: {investigation.case_id}
        </h1>
        <p>
          Status: <span className={`status-badge ${(investigation.status || 'open').toLowerCase().replace(/[_ ]/g, '-')}`}>
            {investigation.status}
          </span>
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/investigations')} aria-label="Back to investigations">
          ← Back to Cases
        </button>
        <button className="btn btn-secondary" onClick={exportMaltego} aria-label="Export for Maltego">
          Export for Maltego
        </button>
      </div>

      {/* LEFT PANEL — Customer Snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="panel">
          <div className="panel-title">Customer Snapshot</div>
          {customer ? (
            <>
              <div className="info-row">
                <span className="info-label">Name</span>
                <span className="info-value">{customer.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Country</span>
                <span className="info-value">{customer.country || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Occupation</span>
                <span className="info-value">{customer.occupation || 'N/A'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Income</span>
                <span className="info-value">
                  {customer.income ? `$${parseFloat(customer.income).toLocaleString()}` : 'N/A'}
                </span>
              </div>
              {risk && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="risk-score-big" style={{ padding: '0.5rem' }}>
                    <div className={`risk-score-number ${tierClass}`} style={{ fontSize: '2rem' }}>{risk.score}</div>
                    <span className={`risk-score-tier ${tierClass}`}>{risk.tier}</span>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {customer.pep_flag && <span className="risk-badge high">PEP</span>}
                {screening && (
                  <span className={`status-badge ${screening.match === 'Match' ? 'match' : screening.match === 'Possible Match' ? 'possible' : 'no-match'}`}>
                    {screening.match}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Customer data not found.</p>
          )}
        </div>

        {/* CENTRE PANEL — Transaction Timeline */}
        <div className="panel">
          <div className="panel-title">Transaction Timeline</div>
          {transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <h3>No transactions</h3>
              <p>No transaction history available for this customer.</p>
            </div>
          ) : (
            <>
              <div className="timeline" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {transactions.map(tx => (
                  <div
                    key={tx.transaction_id || tx.id}
                    className={`timeline-event ${tx.flagged || tx.rule_triggered ? 'suspicious' : ''}`}
                  >
                    <div className="event-date">
                      {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : 'N/A'}
                      {tx.transaction_type ? ` — ${tx.transaction_type}` : ''}
                    </div>
                    <div className="event-detail">
                      <span className="event-amount">
                        ${parseFloat(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      {tx.country ? ` → ${tx.country}` : ''}
                      {tx.rule_triggered && (
                        <span style={{ color: '#f59e0b', fontSize: '0.7rem', marginLeft: '0.5rem' }}>
                          [{tx.rule_triggered}]
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Counterparties */}
              {counterparties.length > 0 && (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
                    Counterparties ({counterparties.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {counterparties.slice(0, 10).map(cp => (
                      <span key={cp} style={{
                        padding: '0.15rem 0.5rem',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--text-secondary)',
                      }}>
                        {cp}
                      </span>
                    ))}
                    {counterparties.length > 10 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        +{counterparties.length - 10} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* BOTTOM PANEL — Analyst Notes and Decisions */}
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Analyst Notes & Decisions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label htmlFor="inv-summary">Investigation Summary</label>
            <textarea
              id="inv-summary"
              className="form-textarea"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Summarize your investigation findings..."
              aria-label="Investigation summary"
            />
          </div>
          <div className="form-group">
            <label htmlFor="inv-justification">Justification</label>
            <textarea
              id="inv-justification"
              className="form-textarea"
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Provide your reasoning..."
              aria-label="Justification"
            />
          </div>
          <div className="form-group">
            <label htmlFor="inv-evidence">Evidence Notes</label>
            <textarea
              id="inv-evidence"
              className="form-textarea"
              value={evidence}
              onChange={e => setEvidence(e.target.value)}
              placeholder="Document supporting evidence..."
              aria-label="Evidence notes"
            />
          </div>
        </div>

        <div className="decision-buttons">
          <button
            className="btn btn-success"
            onClick={() => handleDecision('closed_false_positive')}
            disabled={saving}
            aria-label="Close as false positive"
          >
            Close — False Positive
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleDecision('escalated')}
            disabled={saving}
            aria-label="Escalate"
          >
            Escalate
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleDecision('draft_sar')}
            disabled={saving}
            aria-label="Draft SAR"
          >
            Draft SAR
          </button>
        </div>

        {/* SAR Draft Form */}
        {showSarForm && (
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(167, 139, 250, 0.06)', borderRadius: '12px', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
            <div className="section-title" style={{ marginTop: 0, color: '#a78bfa' }}>SAR Draft Form</div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div className="info-row">
                <span className="info-label">Customer ID</span>
                <span className="info-value">{customer?.customer_id || investigation.customer_id}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Alert Type</span>
                <span className="info-value">{investigation.alert_type || 'N/A'}</span>
              </div>
              <div className="form-group">
                <label htmlFor="sar-description">Description</label>
                <textarea id="sar-description" className="form-textarea" value={sarData.description}
                  onChange={e => setSarData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the suspicious activity..." aria-label="SAR description" />
              </div>
              <div className="form-group">
                <label htmlFor="sar-evidence">Evidence</label>
                <textarea id="sar-evidence" className="form-textarea" value={sarData.evidence}
                  onChange={e => setSarData(p => ({ ...p, evidence: e.target.value }))}
                  placeholder="List supporting evidence..." aria-label="SAR evidence" />
              </div>
              <div className="form-group">
                <label htmlFor="sar-recommendation">Recommendation</label>
                <textarea id="sar-recommendation" className="form-textarea" value={sarData.recommendation}
                  onChange={e => setSarData(p => ({ ...p, recommendation: e.target.value }))}
                  placeholder="Your recommendation..." aria-label="SAR recommendation" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
