import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllCustomers, fetchTransactionsForCustomer, computeRiskScore } from '../services/dataService';
import './pages.css';

export default function CustomerRisk() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCustomersWithRisk();
  }, []);

  async function loadCustomersWithRisk() {
    setLoading(true);
    try {
      const allCustomers = await fetchAllCustomers();
      const enriched = await Promise.all(
        allCustomers.map(async (cust) => {
          const txns = await fetchTransactionsForCustomer(cust.customer_id);
          const risk = computeRiskScore(cust, txns);
          return { ...cust, risk };
        })
      );
      // Sort by score descending
      enriched.sort((a, b) => b.risk.score - a.risk.score);
      setCustomers(enriched);
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  const filtered = customers.filter(c => {
    if (filterTier !== 'ALL' && c.risk.tier !== filterTier) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!(c.normalized_name || '').includes(term) && !(c.customer_id || '').toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path d="M20 8v6M23 11h-6" />
          </svg>
          Customer Risk Analysis
        </h1>
        <p>Evaluate and score customer risk profiles for AML compliance</p>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            aria-label="Search customers"
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(tier => (
            <button
              key={tier}
              className={`btn ${filterTier === tier ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterTier(tier)}
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner-sm" />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Computing risk scores...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <h3>No customers found</h3>
            <p>{searchTerm ? 'Try a different search term.' : 'Upload customers in the Customer Master File section first.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Customer ID</th>
                <th>Country</th>
                <th>Risk Score</th>
                <th>Tier</th>
                <th>Rules Triggered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.customer_id}
                  className="clickable-row"
                  onClick={() => navigate(`/customers/${c.customer_id}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View profile for ${c.name}`}
                >
                  <td className="name-cell">{c.name}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                    {c.customer_id}
                  </td>
                  <td>{c.country || 'N/A'}</td>
                  <td>
                    <div className="risk-bar-container">
                      <div className="risk-bar">
                        <div
                          className={`risk-bar-fill ${c.risk.tier.toLowerCase()}`}
                          style={{ width: `${c.risk.score}%` }}
                        />
                      </div>
                      <span style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: c.risk.tier === 'HIGH' ? '#ef4444' : c.risk.tier === 'MEDIUM' ? '#f59e0b' : '#22c55e'
                      }}>
                        {c.risk.score}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`risk-badge ${c.risk.tier.toLowerCase()}`}>
                      {c.risk.tier}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {c.risk.rules_triggered.length > 0 ? c.risk.rules_triggered.join(', ') : 'None'}
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
