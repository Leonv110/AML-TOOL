import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllCustomers } from '../services/dataService';
import './pages.css';

export default function CustomerDirectory() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      // Single query — no N+1. Uses risk_tier from customers table.
      const allCustomers = await fetchAllCustomers();
      // Sort high risk first using stored risk_tier
      const sorted = (allCustomers || []).sort((a, b) => {
        const tierOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (tierOrder[b.risk_tier] || 0) - (tierOrder[a.risk_tier] || 0);
      });
      setCustomers(sorted);
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  const filtered = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (c.normalized_name || '').includes(term) || (c.customer_id || '').toLowerCase().includes(term);
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
          Customer Directory
        </h1>
        <p>Browse and search all customers — click any row to view their full profile</p>
      </div>

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
      </div>

      <div className="card">
        {loading ? (
          <div className="skeleton-table">
            <div className="skeleton-row header">
              <div className="skeleton-cell" style={{ width: '25%' }} />
              <div className="skeleton-cell" style={{ width: '15%' }} />
              <div className="skeleton-cell" style={{ width: '20%' }} />
              <div className="skeleton-cell" style={{ width: '15%' }} />
              <div className="skeleton-cell" style={{ width: '10%' }} />
              <div className="skeleton-cell" style={{ width: '15%' }} />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="skeleton-row" key={i}>
                <div className="skeleton-cell" style={{ width: '25%' }} />
                <div className="skeleton-cell" style={{ width: '15%' }} />
                <div className="skeleton-cell" style={{ width: '20%' }} />
                <div className="skeleton-cell" style={{ width: '15%' }} />
                <div className="skeleton-cell" style={{ width: '10%' }} />
                <div className="skeleton-cell" style={{ width: '15%' }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
            <h3>No customers found</h3>
            <p>{searchTerm ? 'Try a different search term.' : 'Upload customer data in the Customer Master section first.'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Customer ID</th>
                <th>Risk Score</th>
                <th>Country</th>
                <th>PEP</th>
                <th>Last Review</th>
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
                  <td>
                    <div className="risk-bar-container">
                      <span className={`risk-badge ${(c.risk_tier || 'low').toLowerCase()}`}>
                        {c.risk_tier || 'LOW'}
                      </span>
                    </div>
                  </td>
                  <td>{c.country || 'N/A'}</td>
                  <td>
                    {c.pep_flag ? (
                      <span className="risk-badge high">PEP</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {c.last_review ? new Date(c.last_review).toLocaleDateString() : 'N/A'}
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
