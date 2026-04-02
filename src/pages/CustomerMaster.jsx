import { useState, useEffect, useRef } from 'react';
import { upsertCustomers, fetchAllCustomers } from '../services/dataService';
import * as XLSX from 'xlsx';
import './pages.css';

const REQUIRED_COLUMNS = ['Customer_ID', 'Account_Number', 'Name', 'DOB', 'Occupation', 'Income', 'Country', 'PAN'];
const PAGE_SIZE = 20;

export default function CustomerMaster() {
  const [customers, setCustomers] = useState([]);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const data = await fetchAllCustomers();
      setCustomers(data);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }

  function findColumn(row, target) {
    const keys = Object.keys(row);
    const found = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '') === target.toLowerCase().replace(/[\s_-]/g, ''));
    return found || null;
  }

  function validateColumns(rows) {
    if (rows.length === 0) return 'File is empty';
    const firstRow = rows[0];
    for (const col of REQUIRED_COLUMNS) {
      const mapped = findColumn(firstRow, col);
      if (!mapped) return `Missing required column: ${col}`;
    }
    return null;
  }

  function validateData(rows) {
    const errors = [];
    rows.forEach((row, idx) => {
      const incomeKey = findColumn(row, 'Income');
      if (incomeKey && row[incomeKey] !== undefined && row[incomeKey] !== '') {
        const val = parseFloat(row[incomeKey]);
        if (isNaN(val)) {
          errors.push(`Column Income has invalid data in row ${idx + 2}`);
        }
      }
      const dobKey = findColumn(row, 'DOB');
      if (dobKey && row[dobKey] !== undefined && row[dobKey] !== '') {
        if (!(row[dobKey] instanceof Date)) {
          const d = new Date(row[dobKey]);
          if (isNaN(d.getTime())) {
            errors.push(`Column DOB has invalid data in row ${idx + 2}`);
          }
        }
      }
    });
    return errors.length > 0 ? errors[0] : null;
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setStatus(null);

    try {
      const rows = await parseFile(file);

      // Validate columns
      const colError = validateColumns(rows);
      if (colError) {
        setStatus({ type: 'error', message: colError });
        setUploading(false);
        return;
      }

      // Validate data types
      const dataError = validateData(rows);
      if (dataError) {
        setStatus({ type: 'error', message: dataError });
        setUploading(false);
        return;
      }

      // Map rows to DB schema
      const mapped = rows.map(row => {
        const nameKey = findColumn(row, 'Name');
        const nameVal = row[nameKey]?.toString() || '';
        const dobKey = findColumn(row, 'DOB');
        let dobVal = null;
        if (dobKey && row[dobKey]) {
          if (row[dobKey] instanceof Date) {
            dobVal = row[dobKey].toISOString().split('T')[0];
          } else {
            const d = new Date(row[dobKey]);
            if (!isNaN(d.getTime())) dobVal = d.toISOString().split('T')[0];
          }
        }

        return {
          customer_id: row[findColumn(row, 'Customer_ID')]?.toString(),
          account_number: row[findColumn(row, 'Account_Number')]?.toString(),
          name: nameVal,
          normalized_name: nameVal.toLowerCase().trim(),
          date_of_birth: dobVal,
          occupation: row[findColumn(row, 'Occupation')]?.toString() || null,
          income: parseFloat(row[findColumn(row, 'Income')]) || null,
          country: row[findColumn(row, 'Country')]?.toString() || null,
          pan_aadhaar: row[findColumn(row, 'PAN')]?.toString() || null,
          pep_flag: false,
        };
      });

      const count = await upsertCustomers(mapped);
      setStatus({ type: 'success', message: `Successfully uploaded ${count} customer records.` });
      setFile(null);
      await loadCustomers();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (f) {
      if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
        setStatus({ type: 'error', message: 'Please upload a valid .xlsx or .csv file.' });
        return;
      }
      setFile(f);
      setStatus(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
        setStatus({ type: 'error', message: 'Please upload a valid .xlsx or .csv file.' });
        return;
      }
      setFile(f);
      setStatus(null);
    }
  }

  // Filter customers
  const filtered = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (c.normalized_name || '').includes(term) || (c.customer_id || '').toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <polyline points="9 15 12 12 15 15" />
          </svg>
          Customer Master File
        </h1>
        <p>Upload customer data — this is the foundation for all other modules</p>
      </div>

      {/* Upload Zone */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {!file ? (
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload customer file"
          >
            <input
              type="file"
              hidden
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              aria-label="Choose file"
            />
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <h3>Click to upload or drag and drop</h3>
            <p>Excel (.xlsx) or CSV files — requires columns: Customer_ID, Account_Number, Name, DOB, Occupation, Income, Country, PAN</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.875rem' }}>{file.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!uploading && (
                <button className="btn btn-secondary" onClick={() => { setFile(null); setStatus(null); }} aria-label="Remove file">
                  Remove
                </button>
              )}
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} aria-label="Upload file">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        )}

        {status && (
          <div className={status.type === 'error' ? 'error-banner' : 'success-banner'} style={{ marginTop: '1rem' }}>
            {status.type === 'error' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {status.message}
          </div>
        )}
      </div>

      {/* Customer Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="section-title" style={{ margin: 0 }}>Customer Directory</div>
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              aria-label="Search customers"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner-sm" />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading customers...</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
            </svg>
            <h3>No customers found</h3>
            <p>{searchTerm ? 'Try a different search term.' : 'Upload a Customer Master File above to get started.'}</p>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer ID</th>
                  <th>Country</th>
                  <th>PEP</th>
                  <th>Last Review</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr key={c.customer_id}>
                    <td className="name-cell">{c.name}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{c.customer_id}</td>
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

            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} aria-label="Previous page">
                  ← Prev
                </button>
                <span className="pagination-info">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} aria-label="Next page">
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
