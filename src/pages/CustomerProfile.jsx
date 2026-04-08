import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchCustomerById, fetchTransactionsForCustomer, fetchAlertsForCustomer,
  fetchDocumentsForCustomer, fetchNotesForCustomer, computeRiskScore,
  uploadDocument, saveNote
} from '../services/dataService';
import { logEvent } from '../services/auditService';
import { screenCustomer } from '../services/screeningService';
import './pages.css';

export default function CustomerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [risk, setRisk] = useState(null);
  const [screening, setScreening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [docType, setDocType] = useState('Passport');
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [id]);

  async function loadProfile() {
    setLoading(true);
    try {
      const cust = await fetchCustomerById(id);
      if (!cust) {
        setLoading(false);
        return;
      }
      setCustomer(cust);

      const [txns, alertData, docs, noteData] = await Promise.all([
        fetchTransactionsForCustomer(id),
        fetchAlertsForCustomer(id),
        fetchDocumentsForCustomer(id),
        fetchNotesForCustomer(id),
      ]);
      setTransactions(txns);
      setAlerts(alertData);
      setDocuments(docs);
      setNotes(noteData);

      const riskResult = computeRiskScore(cust, txns);
      setRisk(riskResult);

      // Run screening on page load
      const screenResult = await screenCustomer(cust.name, cust.date_of_birth, cust.country);
      setScreening(screenResult);

      logEvent('CUSTOMER_VIEWED', 'customer', id, { name: cust.name, country: cust.country });
      logEvent('SCREENING_RUN', 'customer', id, { name: cust.name, result: screenResult?.match });
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await saveNote({
        customer_id: id,
        content: noteText.trim(),
        analyst_name: user?.email || 'Unknown',
        created_by: user?.id || null,
      });
      setNoteText('');
      const updated = await fetchNotesForCustomer(id);
      setNotes(updated);
    } catch (err) {
      // Handle silently
    } finally {
      setSavingNote(false);
    }
  }

  async function handleUploadDoc() {
    if (!docFile) return;
    setUploadingDoc(true);
    try {
      await uploadDocument({
        customer_id: id,
        document_type: docType,
        file_name: docFile.name,
        uploaded_by: user?.id || null,
      });
      setDocFile(null);
      const updated = await fetchDocumentsForCustomer(id);
      setDocuments(updated);
    } catch (err) {
      // Handle silently
    } finally {
      setUploadingDoc(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="loading-spinner-sm" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Customer not found</h3>
          <p>No customer found with ID: {id}</p>
        </div>
      </div>
    );
  }

  const tierClass = risk ? risk.tier.toLowerCase() : 'low';

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{customer.name}</h1>
        <p>Customer ID: {customer.customer_id} — Account: {customer.account_number}</p>
      </div>

      {/* Top 3 Panels */}
      <div className="panels-row">
        {/* Profile Info Card */}
        <div className="panel">
          <div className="panel-title">Profile Information</div>
          <div className="info-row">
            <span className="info-label">Name</span>
            <span className="info-value">{customer.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Date of Birth</span>
            <span className="info-value">
              {customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString() : 'N/A'}
            </span>
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
          <div className="info-row">
            <span className="info-label">Country</span>
            <span className="info-value">{customer.country || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Account Number</span>
            <span className="info-value" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
              {customer.account_number}
            </span>
          </div>
        </div>

        {/* Risk Score Box */}
        <div className="panel">
          <div className="panel-title">Risk Score</div>
          {risk && (
            <>
              <div className="risk-score-big">
                <div className={`risk-score-number ${tierClass}`}>{risk.score}</div>
                <span className={`risk-score-tier ${tierClass}`}>{risk.tier}</span>
              </div>
              <div className="score-breakdown">
                <div className="score-breakdown-item">
                  <span className="label">Country Risk</span>
                  <span className="value">{risk.breakdown.country_risk}/30</span>
                </div>
                <div className="score-breakdown-item">
                  <span className="label">Income Mismatch</span>
                  <span className="value">{risk.breakdown.income_mismatch}/25</span>
                </div>
                <div className="score-breakdown-item">
                  <span className="label">Transaction Velocity</span>
                  <span className="value">{risk.breakdown.transaction_velocity}/25</span>
                </div>
                <div className="score-breakdown-item">
                  <span className="label">Account Factors</span>
                  <span className="value">{risk.breakdown.account_factors}/20</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Screening Results */}
        <div className="panel">
          <div className="panel-title">Screening Results</div>
          {screening ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span className={`status-badge ${screening.match === 'Match' ? 'match' : screening.match === 'Possible Match' ? 'possible' : 'no-match'}`}>
                  {screening.match}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {screening.score}/100
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">PEP Status</span>
                <span className="info-value">
                  {customer.pep_flag ? (
                    <span className="risk-badge high">PEP</span>
                  ) : (
                    <span style={{ color: 'var(--risk-low)' }}>Not PEP</span>
                  )}
                </span>
              </div>
              {screening.matched_name && (
                <div className="info-row">
                  <span className="info-label">Matched Name</span>
                  <span className="info-value">{screening.matched_name}</span>
                </div>
              )}
              {screening.pep_category && (
                <div className="info-row">
                  <span className="info-label">PEP Category</span>
                  <span className="info-value">{screening.pep_category}</span>
                </div>
              )}
              {screening.sources.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.35rem' }}>
                    Sources
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {screening.sources.map(src => (
                      <span key={src} className="risk-badge medium" style={{ textTransform: 'none', fontSize: '0.6rem' }}>
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="loading-state" style={{ padding: '1rem' }}>
              <div className="loading-spinner-sm" />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Screening...</p>
            </div>
          )}
        </div>
      </div>

      {/* 4 Sub-Tabs */}
      <div className="card">
        <div className="tabs">
          {['transactions', 'alerts', 'documents', 'notes'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              aria-label={`${tab} tab`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab 1: Transactions */}
        {activeTab === 'transactions' && (
          transactions.length === 0 ? (
            <div className="empty-state">
              <h3>No transactions found</h3>
              <p>No transaction history for this customer.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Txn ID</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Country</th>
                  <th>Rule Triggered</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map(tx => (
                  <tr key={tx.transaction_id || tx.id} style={tx.flagged ? { background: 'rgba(239, 68, 68, 0.04)' } : {}}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{tx.transaction_id}</td>
                    <td style={{ fontSize: '0.75rem' }}>
                      {tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                      ${parseFloat(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{tx.transaction_type || 'N/A'}</td>
                    <td>{tx.country || 'N/A'}</td>
                    <td style={{ fontSize: '0.75rem', color: tx.rule_triggered ? '#f59e0b' : 'var(--text-muted)' }}>
                      {tx.rule_triggered || 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Tab 2: Alerts */}
        {activeTab === 'alerts' && (
          alerts.length === 0 ? (
            <div className="empty-state">
              <h3>No alerts found</h3>
              <p>No alerts have been generated for this customer.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert ID</th>
                  <th>Rule</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.alert_id || a.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{a.alert_id}</td>
                    <td style={{ fontSize: '0.75rem' }}>{a.rule_triggered || 'N/A'}</td>
                    <td>
                      <span className={`risk-badge ${(a.risk_level || '').toLowerCase()}`}>
                        {a.risk_level || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${(a.status || 'open').toLowerCase()}`}>
                        {a.status || 'open'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* Tab 3: Documents */}
        {activeTab === 'documents' && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ minWidth: '150px' }}>
                <label htmlFor="doc-type">Document Type</label>
                <select id="doc-type" className="form-input" value={docType} onChange={e => setDocType(e.target.value)} aria-label="Document type">
                  <option value="Passport">Passport</option>
                  <option value="Utility Bill">Utility Bill</option>
                  <option value="Bank Statement">Bank Statement</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="doc-file">File</label>
                <input
                  id="doc-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => setDocFile(e.target.files[0])}
                  className="form-input"
                  aria-label="Choose document file"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleUploadDoc}
                disabled={!docFile || uploadingDoc}
                aria-label="Upload document"
              >
                {uploadingDoc ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="empty-state">
                <h3>No documents uploaded</h3>
                <p>Upload KYC documents using the form above.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td className="name-cell">{doc.file_name}</td>
                      <td>{doc.document_type}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 4: Notes */}
        {activeTab === 'notes' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <textarea
                className="form-textarea"
                placeholder="Type your investigation notes here..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                aria-label="Investigation notes"
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: '0.5rem' }}
                onClick={handleSaveNote}
                disabled={!noteText.trim() || savingNote}
                aria-label="Save note"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="empty-state">
                <h3>No notes yet</h3>
                <p>Add investigation notes using the form above.</p>
              </div>
            ) : (
              <div>
                {notes.map(note => (
                  <div key={note.id} style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--border-color)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-accent)' }}>
                        {note.analyst_name || 'Unknown Analyst'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {note.created_at ? new Date(note.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: 0 }}>
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
