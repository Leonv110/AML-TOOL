import { useState, useEffect } from 'react';
import { screenCustomer } from '../services/screeningService';
import { fetchAllCustomers, fetchDistinctCountries, updateCustomerPEP } from '../services/dataService';
import './pages.css';

export default function Screening() {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState([]);
  const [result, setResult] = useState(null);
  const [screening, setScreening] = useState(false);
  const [bulkScreening, setBulkScreening] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  useEffect(() => {
    fetchDistinctCountries().then(setCountries);
  }, []);

  async function handleScreen() {
    if (!name.trim()) return;
    setScreening(true);
    setResult(null);
    try {
      const res = await screenCustomer(name, dob, country);
      setResult(res);
    } catch (err) {
      setResult({ match: 'Error', score: 0, matched_name: null, sources: [], pep_category: null });
    } finally {
      setScreening(false);
    }
  }

  async function handleBulkScreen() {
    setBulkScreening(true);
    setBulkResults(null);
    try {
      const customers = await fetchAllCustomers();
      let matchCount = 0;
      let possibleCount = 0;

      for (const cust of customers) {
        const res = await screenCustomer(cust.name, cust.date_of_birth, cust.country);
        if (res.match === 'Match' || res.match === 'Possible Match') {
          if (res.pep_category) {
            await updateCustomerPEP(cust.customer_id, true);
          }
          if (res.match === 'Match') matchCount++;
          else possibleCount++;
        }
      }

      setBulkResults({
        total: customers.length,
        matches: matchCount,
        possible: possibleCount,
        clean: customers.length - matchCount - possibleCount,
      });
    } catch (err) {
      setBulkResults({ error: err.message });
    } finally {
      setBulkScreening(false);
    }
  }

  function getMatchClass(match) {
    if (match === 'Match') return 'match';
    if (match === 'Possible Match') return 'possible';
    return 'no-match';
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <path d="M11 8v4M11 14h.01" />
          </svg>
          Customer Screening
        </h1>
        <p>Screen individuals against sanctions lists, PEP databases, and watchlists</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Input Form */}
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Screen Individual</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="screen-name">Full Name</label>
              <input
                id="screen-name"
                className="form-input"
                type="text"
                placeholder="Enter full name..."
                value={name}
                onChange={e => setName(e.target.value)}
                aria-label="Full name for screening"
              />
            </div>
            <div className="form-group">
              <label htmlFor="screen-dob">Date of Birth</label>
              <input
                id="screen-dob"
                className="form-input"
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                aria-label="Date of birth"
              />
            </div>
            <div className="form-group">
              <label htmlFor="screen-country">Country</label>
              <select
                id="screen-country"
                className="form-input"
                value={country}
                onChange={e => setCountry(e.target.value)}
                aria-label="Country"
              >
                <option value="">Select country...</option>
                {countries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleScreen}
              disabled={screening || !name.trim()}
              aria-label="Screen customer"
            >
              {screening ? 'Screening...' : 'Screen Customer'}
            </button>
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
            <div className="section-title" style={{ marginTop: 0 }}>Bulk Screening</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
              Screen all customers in the database against sanctions and PEP lists. Updates PEP flags automatically.
            </p>
            <button
              className="btn btn-secondary"
              onClick={handleBulkScreen}
              disabled={bulkScreening}
              aria-label="Screen all customers"
            >
              {bulkScreening ? 'Screening all customers...' : 'Screen All Customers'}
            </button>

            {bulkResults && !bulkResults.error && (
              <div className="success-banner" style={{ marginTop: '0.75rem' }}>
                Screened {bulkResults.total} customers: {bulkResults.matches} matches, {bulkResults.possible} possible matches, {bulkResults.clean} clean.
              </div>
            )}
            {bulkResults?.error && (
              <div className="error-banner" style={{ marginTop: '0.75rem' }}>
                {bulkResults.error}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Screening Results</div>
          {!result ? (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h3>No results yet</h3>
              <p>Enter a name and click Screen Customer to check against sanctions lists.</p>
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              {/* Match Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span className={`status-badge ${getMatchClass(result.match)}`} style={{ fontSize: '0.875rem', padding: '0.4rem 1rem' }}>
                  {result.match === 'Match' && '⚠ '}
                  {result.match}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: result.score >= 90 ? '#ef4444' : result.score >= 60 ? '#f59e0b' : '#22c55e'
                  }}>
                    {result.score}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>/100</span>
                </div>
              </div>

              {/* Matched Name */}
              {result.matched_name && (
                <div className="info-row">
                  <span className="info-label">Matched Name</span>
                  <span className="info-value">{result.matched_name}</span>
                </div>
              )}

              {/* PEP Category */}
              {result.pep_category && (
                <div className="info-row">
                  <span className="info-label">PEP Category</span>
                  <span className="info-value">{result.pep_category}</span>
                </div>
              )}

              {/* Sources */}
              {result.sources.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="panel-title">Sources</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {result.sources.map(src => (
                      <span key={src} className="risk-badge medium" style={{ textTransform: 'none' }}>
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
