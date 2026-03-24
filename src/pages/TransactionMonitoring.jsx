import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { fetchAllTransactions, fetchRules, toggleRuleStatus, fetchAlertCountForRule } from '../services/dataService';
import './pages.css';

export default function TransactionMonitoring() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', minAmount: '', maxAmount: '', country: '', rule: '' });
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [txns, ruleData] = await Promise.all([
        fetchAllTransactions(),
        fetchRules(),
      ]);
      setTransactions(txns);

      // Enrich rules with live alert counts
      const { data: alertData } = await supabase.from('alerts').select('rule_triggered');
      let counts = {};
      if (alertData) {
        counts = alertData.reduce((acc, alert) => {
          acc[alert.rule_triggered] = (acc[alert.rule_triggered] || 0) + 1;
          return acc;
        }, {});
      }
      const enrichedRules = ruleData.map(rule => ({ ...rule, liveAlertCount: counts[rule.name] || 0 }));
      setRules(enrichedRules);

      // Extract unique countries
      const unique = [...new Set(txns.map(t => t.country).filter(Boolean))];
      setCountries(unique.sort());
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyFilters() {
    setLoading(true);
    try {
      const txns = await fetchAllTransactions(filters);
      setTransactions(txns);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  function handleClearFilters() {
    setFilters({ startDate: '', endDate: '', minAmount: '', maxAmount: '', country: '', rule: '' });
    loadData();
  }

  async function handleToggleRule(rule) {
    const newStatus = rule.status === 'active' ? 'inactive' : 'active';
    try {
      await toggleRuleStatus(rule.id, newStatus);
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: newStatus } : r));
    } catch (err) {
      // Handle silently
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Transaction Monitoring
        </h1>
        <p>Real-time transaction surveillance and pattern detection</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <div className="form-group">
            <label htmlFor="txn-start-date">Start Date</label>
            <input id="txn-start-date" className="form-input" type="date" value={filters.startDate}
              onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} aria-label="Start date" />
          </div>
          <div className="form-group">
            <label htmlFor="txn-end-date">End Date</label>
            <input id="txn-end-date" className="form-input" type="date" value={filters.endDate}
              onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} aria-label="End date" />
          </div>
          <div className="form-group">
            <label htmlFor="txn-min-amount">Min Amount</label>
            <input id="txn-min-amount" className="form-input" type="number" placeholder="0" value={filters.minAmount}
              onChange={e => setFilters(p => ({ ...p, minAmount: e.target.value }))} aria-label="Minimum amount" />
          </div>
          <div className="form-group">
            <label htmlFor="txn-max-amount">Max Amount</label>
            <input id="txn-max-amount" className="form-input" type="number" placeholder="Any" value={filters.maxAmount}
              onChange={e => setFilters(p => ({ ...p, maxAmount: e.target.value }))} aria-label="Maximum amount" />
          </div>
          <div className="form-group">
            <label htmlFor="txn-country">Country</label>
            <select id="txn-country" className="form-input" value={filters.country}
              onChange={e => setFilters(p => ({ ...p, country: e.target.value }))} aria-label="Country filter">
              <option value="">All Countries</option>
              {countries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="txn-rule">Rule Triggered</label>
            <select id="txn-rule" className="form-input" value={filters.rule}
              onChange={e => setFilters(p => ({ ...p, rule: e.target.value }))} aria-label="Rule filter">
              <option value="">All Rules</option>
              {rules.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleClearFilters} aria-label="Clear filters">Clear Filters</button>
          <button className="btn btn-primary" onClick={handleApplyFilters} aria-label="Apply filters">Apply Filters</button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title" style={{ marginTop: 0 }}>Transactions</div>
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner-sm" />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <h3>No transactions found</h3>
            <p>Adjust your filters or upload transaction data to see results.</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Txn ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Country</th>
                  <th>Risk Level</th>
                  <th>Rule Triggered</th>
                  <th>Flagged</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 50).map(tx => (
                  <tr key={tx.transaction_id || tx.id}
                    className={tx.flagged ? '' : ''}
                    style={tx.flagged ? { background: 'rgba(239, 68, 68, 0.04)' } : {}}
                  >
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{tx.transaction_id}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{tx.customer_id}</td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      ${parseFloat(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{tx.transaction_type || 'N/A'}</td>
                    <td>{tx.country || 'N/A'}</td>
                    <td>
                      {tx.country_risk_level ? (
                        <span className={`risk-badge ${(tx.country_risk_level || '').toLowerCase()}`}>
                          {tx.country_risk_level}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: tx.rule_triggered ? '#f59e0b' : 'var(--text-muted)' }}>
                      {tx.rule_triggered || 'None'}
                    </td>
                    <td>
                      {tx.flagged ? (
                        <span className="risk-badge high" style={{ fontSize: '0.6rem' }}>Flagged</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Clean</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              Showing {Math.min(transactions.length, 50)} of {transactions.length} transactions
            </div>
          </>
        )}
      </div>

      {/* Rule Library */}
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Rule Library
        </div>
        {rules.length === 0 ? (
          <div className="empty-state">
            <h3>No rules configured</h3>
            <p>Run the migration SQL to seed 8 AML detection rules.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Description</th>
                <th>Threshold</th>
                <th>Status</th>
                <th>Alerts Triggered</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.id}>
                  <td className="name-cell">{rule.name}</td>
                  <td style={{ fontSize: '0.75rem', maxWidth: '250px' }}>{rule.description}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{rule.threshold}</td>
                  <td>
                    <label className="toggle-switch" aria-label={`Toggle ${rule.name} rule`}>
                      <input
                        type="checkbox"
                        checked={rule.status === 'active'}
                        onChange={() => handleToggleRule(rule)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {rule.liveAlertCount || 0}
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
