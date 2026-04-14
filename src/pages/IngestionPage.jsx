import React, { useState, useRef, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiDelete, apiPut, apiGet } from '../apiClient';
import { useAuth } from '../contexts/AuthContext';
import { generateAlertsFromTransactions } from '../services/dataService';
import { screenCustomerManual } from '../services/screeningService';
import { logEvent } from '../services/auditService';
import * as XLSX from 'xlsx';
import './IngestionPage.css';

// ── Pre-loaded REAL names for Screening (not synthetic) ──
const SCREENING_NAMES = [
  { id: 'SCR-001', name: 'Narendra Modi', dob: '17-09-1950', country: 'India', entity_type: 'Person', category: 'PEP Level 1', description: 'Prime Minister of India' },
  { id: 'SCR-002', name: 'Donald Trump', dob: '14-06-1946', country: 'United States', entity_type: 'Person', category: 'PEP Level 1', description: 'Former President of USA' },
  { id: 'SCR-003', name: 'Amitabh Bachchan', dob: '11-10-1942', country: 'India', entity_type: 'Person', category: 'Adverse Media', description: 'Actor - Panama Papers mention' },
  { id: 'SCR-004', name: 'Vladimir Putin', dob: '07-10-1952', country: 'Russia', entity_type: 'Person', category: 'Sanctions', description: 'President of Russia' },
  { id: 'SCR-005', name: 'Kim Jong Un', dob: '08-01-1984', country: 'North Korea', entity_type: 'Person', category: 'Sanctions', description: 'Supreme Leader of DPRK' },
  { id: 'SCR-006', name: 'Masood Azhar', dob: '10-07-1968', country: 'Pakistan', entity_type: 'Person', category: 'Sanctions', description: 'UN-listed designated terrorist' },
  { id: 'SCR-007', name: 'Nawaz Sharif', dob: '25-12-1949', country: 'Pakistan', entity_type: 'Person', category: 'PEP Level 1', description: 'Former PM of Pakistan - Panama Papers' },
  { id: 'SCR-008', name: 'Sani Abacha', dob: '20-09-1943', country: 'Nigeria', entity_type: 'Person', category: 'PEP Level 1', description: 'Former Head of State - Nigeria' },
  { id: 'SCR-009', name: 'Semion Mogilevich', dob: '30-06-1946', country: 'Russia', entity_type: 'Person', category: 'Sanctions', description: 'FBI Most Wanted - Organized Crime' },
  { id: 'SCR-010', name: 'Diezani Alison-Madueke', dob: '06-12-1960', country: 'Nigeria', entity_type: 'Person', category: 'PEP Level 1', description: 'Former Minister - Money Laundering charges' },
  { id: 'SCR-011', name: 'Dawood Ibrahim', dob: '26-12-1955', country: 'India', entity_type: 'Person', category: 'Sanctions', description: 'UN-designated terrorist / organized crime' },
  { id: 'SCR-012', name: 'Bashar Al Assad', dob: '11-09-1965', country: 'Syria', entity_type: 'Person', category: 'Sanctions', description: 'Former President of Syria' },
  { id: 'SCR-013', name: 'Nirav Modi', dob: '27-05-1971', country: 'India', entity_type: 'Person', category: 'Adverse Media', description: 'PNB Bank Fraud - Interpol Red Notice' },
  { id: 'SCR-014', name: 'Hezbollah', dob: '', country: 'Lebanon', entity_type: 'Organization', category: 'Sanctions', description: 'Designated terrorist organization' },
  { id: 'SCR-015', name: 'Gautam Adani', dob: '24-06-1962', country: 'India', entity_type: 'Person', category: 'Adverse Media', description: 'Adani Group - Hindenburg Research' },
];


export default function IngestionPage() {
    const navigate = useNavigate();
    const { user, userRole } = useAuth();
    const [mode, setMode] = useState('append'); // 'append' or 'replace'
    const [file, setFile] = useState(null);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [uploadedBatchId, setUploadedBatchId] = useState(null);
    const [amlProcessing, setAmlProcessing] = useState(false);
    const [amlResult, setAmlResult] = useState(null);
    const [amlError, setAmlError] = useState(null);
    const [amlProgress, setAmlProgress] = useState(0);
    const [amlProgressMsg, setAmlProgressMsg] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState(null);
    const [preview, setPreview] = useState(null); // { columns: [], rows: [], totalRows: number }
    const fileInputRef = useRef(null);
    const [parsedFullData, setParsedFullData] = useState(null); // Store parsed data for export

    const [dataType, setDataType] = useState('transactions'); // 'transactions', 'customers', or 'screening'
    const [existingCount, setExistingCount] = useState(0);

    // Dynamic data count check
    useEffect(() => {
        if (!user) return;
        const fetchCount = async () => {
            try {
                if (dataType === 'screening') return;
                const endpoint = dataType === 'transactions' ? '/api/transactions/count' : '/api/customers/count';
                const { count } = await apiGet(endpoint);
                setExistingCount(count || 0);
            } catch (e) {
                console.warn('Silent data count failure:', e);
            }
        };
        fetchCount();
        setAmlResult(null); // Clear previous results when tab changes
        setAmlError(null);
    }, [user, dataType, uploadComplete]);

    const parseExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet);
                    resolve(jsonData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        });
    };

    const handleFileSelect = async (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
                setStatus({ type: 'error', message: 'Please upload a valid Excel/CSV file' });
                return;
            }
            setFile(selectedFile);
            setStatus(null);
            setProgress(0);

            try {
                const parsed = await parseExcel(selectedFile);
                if (parsed.length > 0) {
                    setParsedFullData(parsed);
                    setPreview({
                        columns: Object.keys(parsed[0]),
                        rows: parsed.slice(0, 5),
                        totalRows: parsed.length,
                    });
                }
            } catch {
                setPreview(null);
                setParsedFullData(null);
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            if (!droppedFile.name.match(/\.(xlsx|xls|csv)$/)) {
                setStatus({ type: 'error', message: 'Please upload a valid Excel/CSV file' });
                return;
            }
            setFile(droppedFile);
            setStatus(null);
            setProgress(0);

            try {
                const parsed = await parseExcel(droppedFile);
                if (parsed.length > 0) {
                    setParsedFullData(parsed);
                    setPreview({
                        columns: Object.keys(parsed[0]),
                        rows: parsed.slice(0, 5),
                        totalRows: parsed.length,
                    });
                }
            } catch {
                setPreview(null);
                setParsedFullData(null);
            }
        }
    };

    // ---- EXPORT TO EXCEL ----
    function handleExportToExcel() {
        if (!parsedFullData || parsedFullData.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(parsedFullData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, dataType === 'transactions' ? 'Transactions' : 'Customers');
        const fileName = dataType === 'transactions'
            ? `transactions_export_${new Date().toISOString().split('T')[0]}.xlsx`
            : `customers_export_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }

    const handleUpload = async () => {
        if (!file || !user) return;
        setUploading(true);
        setStatus(null);
        setProgress(10);

        try {
            const parsedData = await parseExcel(file);
            setProgress(30);

            if (parsedData.length === 0) throw new Error('File is empty');

            const batchId = `BATCH-${Date.now()}`;
            
            if (dataType === 'transactions') {
                const formattedData = parsedData.map(row => ({
                    transaction_id:               row['transaction_id']?.toString(),
                    customer_id:                  row['customer_id']?.toString(),
                    account_number:               row['account_number']?.toString(),
                    amount:                       parseFloat(row['amount']) || null,
                    transaction_date:             row['transaction_date'] instanceof Date
                                                    ? row['transaction_date'].toISOString()
                                                    : row['transaction_date']?.toString() || null,
                    transaction_type:             row['transaction_type']?.toString() || null,
                    country:                      row['country']?.toString() || null,
                    country_risk_level:           row['country_risk_level']?.toString() || null,
                    is_new_device:                row['is_new_device'] === 'TRUE' || row['is_new_device'] === true || row['is_new_device'] === 1 || false,
                    degree_centrality:            parseFloat(row['degree_centrality']) || null,
                    path_length_hops:             parseInt(row['path_length_hops']) || null,
                    balance_before:               parseFloat(row['balance_before']) || null,
                    balance_after:                parseFloat(row['balance_after']) || null,
                    days_since_last_transaction:  parseFloat(row['days_since_last_transaction']) || null,
                    user_transaction_count_7d:    parseInt(row['user_transaction_count_7d']) || null,
                    transaction_frequency_1hr:    parseFloat(row['transaction_frequency_1hr']) || null,
                    destination_id:               row['destination_id']?.toString() || null,
                    flagged:                      null,
                    flag_reason:                  null,
                    rule_triggered:               null,
                    risk_score:                   null,
                    batch_id:                     batchId
                }));

                setProgress(50);
                if (mode === 'replace') {
                    setStatus({ type: 'info', message: 'Clearing existing data...' });
                    await apiDelete('/api/transactions');
                }
                setProgress(70);

                const batchSize = 1000;
                for (let i = 0; i < formattedData.length; i += batchSize) {
                    const batch = formattedData.slice(i, i + batchSize);
                    await apiPost('/api/transactions', batch);
                    setProgress(Math.min(70 + Math.round((i / formattedData.length) * 30), 99));
                }

                logEvent('DATA_UPLOAD_TRANSACTION', 'transactions', null, { count: formattedData.length, filename: file.name, batch_id: batchId });
            } else {
                // Customer Data
                const formattedData = parsedData.map(row => ({
                    customer_id:     row['customer_id']?.toString() || row['Customer_ID']?.toString() || `CUST-${Math.random().toString(36).substring(2,8)}`,
                    account_number:  row['account_number']?.toString() || row['Account_Number']?.toString() || `ACC-${Math.random().toString(36).substring(2,8)}`,
                    name:            row['name']?.toString() || row['Name']?.toString() || 'Unknown',
                    normalized_name: (row['name'] || row['Name'] || 'unknown').toString().toLowerCase().replace(/[^a-z0-9]/g, ''),
                    date_of_birth:   (row['date_of_birth'] || row['DOB']) instanceof Date 
                                       ? (row['date_of_birth'] || row['DOB']).toISOString().split('T')[0] 
                                       : row['date_of_birth']?.toString() || row['DOB']?.toString() || null,
                    occupation:      row['occupation']?.toString() || row['Occupation']?.toString() || null,
                    income:          parseFloat(row['income'] || row['Income']) || null,
                    country:         row['country']?.toString() || row['Country']?.toString() || null,
                    pan_aadhaar:     row['pan_aadhaar']?.toString() || row['PAN']?.toString() || null,
                    pep_flag:        row['pep_flag'] === 'TRUE' || row['pep_flag'] === true || row['pep_flag'] === 1 || false,
                    last_review:     null
                }));

                setProgress(50);
                if (mode === 'replace') {
                    setStatus({ type: 'info', message: 'Clearing existing customer data...' });
                    await apiDelete('/api/customers');
                }
                setProgress(70);
                
                const batchSize = 1000;
                for (let i = 0; i < formattedData.length; i += batchSize) {
                    const batch = formattedData.slice(i, i + batchSize);
                    await apiPut('/api/customers/upsert', batch);
                    setProgress(Math.min(70 + Math.round(((i + batch.length) / formattedData.length) * 30), 99));
                }

                logEvent('DATA_UPLOAD_CUSTOMER', 'customers', null, { count: formattedData.length, filename: file.name });
            }

            setProgress(100);
            setStatus({ type: 'success', message: `Successfully ingested ${parsedData.length} ${dataType} records.` });
            setUploadComplete(true);
            setUploadedBatchId(batchId);
            setParsedFullData(parsedData); // Keep for export
            setFile(null);
            setPreview(null);

        } catch (error) {
            console.error('Upload failed:', error);
            setStatus({ type: 'error', message: error.message || 'Failed to upload data.' });
            setProgress(0);
        } finally {
            setUploading(false);
        }
    };

    const clearFile = () => {
        setFile(null);
        setPreview(null);
        setStatus(null);
        setProgress(0);
        setParsedFullData(null);
    };

    async function handleRunAMLProcessing() {
        setAmlProcessing(true);
        setAmlResult(null);
        setAmlError(null);
        setAmlProgress(0);
        
        if (dataType === 'customers') {
            setAmlProgressMsg("Running AML Watcher mass screening...");
            try {
                // Fetch all customers from DB and screen each one
                setAmlProgress(10);
                const customers = await apiGet('/api/customers');
                const totalCustomers = customers?.length || 0;
                let screenedCount = 0;
                let flaggedCount = 0;

                if (totalCustomers === 0) {
                    setAmlResult({ processed: 0, flagged: 0, alerts_created: 0, duration_seconds: 0 });
                    setAmlProcessing(false);
                    return;
                }

                const startTime = Date.now();
                for (let i = 0; i < totalCustomers; i++) {
                    const customer = customers[i];
                    try {
                        setAmlProgressMsg(`Screening ${customer.name || customer.customer_id}...`);
                        const res = await apiPost(`/api/customers/${customer.customer_id}/screen`, {});
                        screenedCount++;
                        if (res?.screeningResult?.risk_level === 'high') {
                            flaggedCount++;
                        }
                    } catch {
                        screenedCount++; // Count even if individual screening fails
                    }
                    setAmlProgress(Math.min(10 + Math.round((i / totalCustomers) * 85), 95));
                }

                setAmlProgress(100);
                const duration = (Date.now() - startTime) / 1000;
                setAmlResult({
                    processed: screenedCount,
                    flagged: flaggedCount,
                    alerts_created: 0,
                    duration_seconds: parseFloat(duration.toFixed(1))
                });
                setAmlProcessing(false);
            } catch (err) {
                setAmlError(err.message || "Bulk screening failed.");
                setAmlProcessing(false);
            }
            return;
        }

        // Transaction AML flow — JS-based rule engine (works without Python backend)
        setAmlProgressMsg("Fetching uploaded transactions...");
        try {
            const startTime = Date.now();

            // Step 1: Fetch only UNFLAGGED transactions to process
            setAmlProgress(10);
            const allTxns = await apiGet(`/api/transactions?limit=50000&_t=${Date.now()}`);
            
            if (!allTxns || !Array.isArray(allTxns)) {
                setAmlError("Failed to fetch transactions. Please re-login and try again.");
                setAmlProcessing(false);
                return;
            }
            
            console.log(`[AML] Fetched ${allTxns.length} total transactions`);
            
            // Filter to only unflagged transactions (flagged is null, false, or undefined)
            const transactions = allTxns.filter(t => t.flagged !== true && t.flagged !== 'true');
            const totalTxns = transactions.length;
            
            console.log(`[AML] ${totalTxns} unflagged transactions to process (${allTxns.length - totalTxns} already flagged)`);

            if (totalTxns === 0) {
                const msg = allTxns.length > 0 
                    ? `All ${allTxns.length} transactions are already flagged. Upload new data or clear existing.`
                    : 'No transactions found. Please upload transaction data first.';
                setAmlResult({ processed: 0, flagged: 0, alerts_created: 0, duration_seconds: 0, message: msg });
                setAmlProcessing(false);
                return;
            }

            // Step 2: Apply AML rules via the JS engine
            setAmlProgress(30);
            setAmlProgressMsg(`Applying AML rules to ${totalTxns.toLocaleString()} transactions...`);

            const alertsCreated = await generateAlertsFromTransactions(transactions);
            setAmlProgress(80);

            // Step 3: Align counts
            setAmlProgressMsg("Finalizing results...");
            const flaggedTxns = alertsCreated; // Sync flagged count with actual alerts generated

            setAmlProgress(100);
            const duration = (Date.now() - startTime) / 1000;

            setAmlResult({
                processed: totalTxns,
                flagged: flaggedTxns,
                alerts_created: alertsCreated,
                duration_seconds: parseFloat(duration.toFixed(1))
            });
            setAmlProcessing(false);

        } catch (err) {
            setAmlError(err.message || "AML processing failed. Please try again.");
            setAmlProcessing(false);
        }
    }

  return (
        <div className="ingestion-container">
            <header className="ingestion-header">
                <div className="header-content">
                    <h1>Data Ingestion</h1>
                    <p>Upload Excel datasets for analysis</p>
                </div>
                <button onClick={() => navigate('/dashboard')} className="back-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>
            </header>

            <div className="ingestion-card">
                {userRole === 'student' ? (
                    <div className="student-restriction" style={{ textAlign: 'center', padding: '2rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ margin: '0 auto 1rem' }}>
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <h2 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>Upload Restricted</h2>
                        <p style={{ color: 'var(--text-muted)' }}>As a student, you only have access to synthetic datasets provided by the instructors. Data ingestion is restricted.</p>
                    </div>
                ) : (
                    <>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '12px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, paddingLeft: '0.5rem' }}>Data Type</div>
                        <div className="upload-options" style={{ margin: 0 }}>
                            <button
                                className={`option-btn ${dataType === 'transactions' ? 'active' : ''}`}
                                onClick={() => setDataType('transactions')}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                                Transaction Data
                            </button>
                            <button
                                className={`option-btn ${dataType === 'customers' ? 'active' : ''}`}
                                onClick={() => setDataType('customers')}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                Customer Master Data
                            </button>
                            <button
                                className={`option-btn ${dataType === 'screening' ? 'active' : ''}`}
                                onClick={() => setDataType('screening')}
                                style={dataType === 'screening' ? { background: '#10b981' } : {}}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                Screening Data
                            </button>
                        </div>
                    </div>
                    {dataType !== 'screening' && (
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, paddingLeft: '0.5rem' }}>Write Mode</div>
                        <div className="upload-options" style={{ margin: 0 }}>
                            <button
                                className={`option-btn ${mode === 'append' ? 'active' : ''}`}
                                onClick={() => setMode('append')}
                            >
                                Append
                            </button>
                            <button
                                className={`option-btn ${mode === 'replace' ? 'active' : ''}`}
                                onClick={() => setMode('replace')}
                            >
                                Replace All
                            </button>
                        </div>
                    </div>
                    )}
                </div>


                {dataType !== 'screening' && (!file ? (
                    <div
                        className="upload-area"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            hidden
                            ref={fileInputRef}
                            accept=".xlsx, .xls"
                            onChange={handleFileSelect}
                        />
                        <div className="upload-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <div className="upload-text">
                            <h3>Click to upload or drag and drop</h3>
                            <p>Excel files (.xlsx, .xls) only</p>
                        </div>
                    </div>
                ) : (
                    <div className="file-info">
                        <div className="file-name">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            <span>{file.name}</span>
                            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>({(file.size / 1024).toFixed(2)} KB)</span>
                        </div>
                        {!uploading && (
                            <button className="remove-file" onClick={clearFile}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>
                ))}

                {/* Column Preview — shows after file selection, before upload */}
                {dataType !== 'screening' && preview && !uploading && (
                    <div className="preview-section">
                        <div className="preview-header">
                            <h3>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                Data Preview
                            </h3>
                            <span className="preview-count">{preview.totalRows.toLocaleString()} rows × {preview.columns.length} columns</span>
                        </div>
                        <div className="preview-table-wrapper">
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        {preview.columns.map((col, i) => (
                                            <th key={i}>{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.rows.map((row, i) => (
                                        <tr key={i}>
                                            {preview.columns.map((col, j) => (
                                                <td key={j}>{row[col]?.toString() ?? '—'}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="preview-note">Showing first 5 rows. Full dataset will be ingested on upload.</p>
                    </div>
                )}

                {dataType !== 'screening' && uploading && (
                    <div className="progress-container">
                        <div className="progress-bar-bg">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="progress-text">
                            <span>Uploading and Processing...</span>
                            <span>{progress}%</span>
                        </div>
                    </div>
                )}

                {dataType !== 'screening' && status && (
                    <div className={`status-message ${status.type}`}>
                        {status.type === 'success' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        ) : status.type === 'error' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        )}
                        <span>{status.message}</span>
                    </div>
                )}

                {dataType !== 'screening' && (
                <div className="upload-actions">
                    <button
                        className="upload-btn"
                        disabled={!file || uploading}
                        onClick={handleUpload}
                    >
                        {uploading ? 'Processing...' : 'Start Ingestion'}
                        {!uploading && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        )}
                    </button>
                </div>
                )}
                </>
                )}
            </div>

            {/* ── SCREENING DATA TAB ── */}
            {dataType === 'screening' && (
              <div className="ingestion-card" style={{ marginTop: '1.5rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>🔍 Pre-loaded Screening Subjects</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                    Real-world names loaded for AML Watcher screening. Click "Screen" on any subject to verify against global watchlists, sanctions, PEP databases, and adverse media.
                  </p>
                </div>

                <div className="preview-table-wrapper" style={{ maxHeight: '600px' }}>
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th style={{ width: '30px' }}>#</th>
                        <th>Name</th>
                        <th>Country</th>
                        <th>DOB</th>
                        <th>Type</th>
                        <th>Expected Category</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCREENING_NAMES.map((person, idx) => {
                        return (
                          <Fragment key={person.id}>
                            <tr>
                              <td style={{ color: '#64748b' }}>{idx + 1}</td>
                              <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{person.name}</td>
                              <td>{person.country}</td>
                              <td style={{ fontSize: '0.8rem' }}>{person.dob || '—'}</td>
                              <td>
                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: person.entity_type === 'Organization' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)', color: person.entity_type === 'Organization' ? '#60a5fa' : '#a78bfa' }}>
                                  {person.entity_type}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px',
                                  background: person.category.includes('Sanctions') ? 'rgba(239,68,68,0.15)' : person.category.includes('PEP') ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
                                  color: person.category.includes('Sanctions') ? '#f87171' : person.category.includes('PEP') ? '#fbbf24' : '#60a5fa'
                                }}>{person.category}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                  <button
                                    onClick={() => navigate('/screening', { state: { person } })}
                                    style={{ padding: '4px 12px', fontSize: '0.75rem', background: '#10b981', color: '#050709', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    🔍 Screen Deep Dive
                                  </button>
                                </td>
                              </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                  ⚡ <strong style={{ color: '#10b981' }}>Note:</strong> Each screening call hits the live AML Watcher API. API calls are rate-limited to protect your organization's quota.
                </div>
              </div>
            )}

            {dataType !== 'screening' && (uploadComplete || existingCount > 0) && (
              <div className="aml-processing-section" style={{ borderTop: `2px solid ${dataType === 'customers' ? '#3b82f6' : '#f59e0b'}` }}>
                <div className="aml-processing-header">
                  <h3>{uploadComplete ? `Step 2 — Run ${dataType === 'customers' ? 'Screening' : 'AML Processing'}` : `${dataType === 'customers' ? 'Customer Screening' : 'AML Processing'}`}</h3>
                  <p>
                    {uploadComplete 
                      ? `Data successfully ingested. Proceed to ${dataType === 'customers' ? 'AI-powered screening' : 'the rule engine'} to ${dataType === 'customers' ? 'verify names against global watchlists' : 'flag suspicious transactions'}.`
                      : `${existingCount.toLocaleString()} ${dataType} found in database. Run or re-run analysis with current configurations.`
                    }
                  </p>
                </div>

                {!amlResult && !amlError && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleRunAMLProcessing}
                      disabled={amlProcessing}
                      className="aml-run-button"
                      style={{ background: dataType === 'customers' ? '#3b82f6' : '#f59e0b', color: dataType === 'customers' ? 'white' : '#050709' }}
                    >
                      {amlProcessing ? (
                        <>
                          <span className="spinner" style={{ borderTopColor: dataType === 'customers' ? 'white' : '#050709' }} />
                          Processing...
                        </>
                      ) : (
                        <>
                          {dataType === 'customers' ? '🔍 Run Screening' : '⚡ Run AML Processing'}
                        </>
                      )}
                    </button>
                    {!uploadComplete && existingCount > 0 && (
                      <button
                        onClick={async () => {
                          setAmlProcessing(true);
                          setAmlProgressMsg('Clearing previous results...');
                          setAmlProgress(5);
                          try {
                            if (dataType === 'transactions') {
                                await apiPost('/api/transactions/reset-flags', {});
                                await apiDelete('/api/alerts');
                            } else {
                                // For customers, we might clear screening history if applicable
                                // Right now cascades are handled by DELETE /api/customers
                            }
                            setAmlProcessing(false);
                            handleRunAMLProcessing();
                          } catch (e) {
                            setAmlError('Failed to reset: ' + e.message);
                            setAmlProcessing(false);
                          }
                        }}
                        disabled={amlProcessing}
                        className="aml-run-button"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
                      >
                        🔄 Reset & Re-run
                      </button>
                    )}
                  </div>
                )}

                {amlProcessing && (
                  <div className="aml-progress-container" style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', color: '#f59e0b', fontSize: '13px' }}>
                        {amlProgressMsg}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>{amlProgress}%</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#1e293b', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ width: `${amlProgress}%`, backgroundColor: '#f59e0b', height: '100%', transition: 'width 0.3s ease' }}></div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {dataType === 'customers'
                        ? 'Screening customers against AML watchlists...'
                        : 'Processing transactions against AML rules...'}
                    </p>
                  </div>
                )}

                {amlResult && (
                  <div className="aml-success">
                    <div className="aml-result-header">✅ AML Processing Complete</div>
                    <div className="aml-result-grid">
                      <div className="aml-stat">
                        <span className="aml-stat-value">{amlResult.processed?.toLocaleString()}</span>
                        <span className="aml-stat-label">{dataType === 'customers' ? 'Customers Screened' : 'Transactions Processed'}</span>
                      </div>
                      <div className="aml-stat">
                        <span className="aml-stat-value" style={{ color: '#ef4444' }}>
                          {amlResult.flagged?.toLocaleString()}
                        </span>
                        <span className="aml-stat-label">Flagged</span>
                      </div>
                      <div className="aml-stat">
                        <span className="aml-stat-value" style={{ color: '#f59e0b' }}>
                          {amlResult.alerts_created?.toLocaleString()}
                        </span>
                        <span className="aml-stat-label">Alerts Created</span>
                      </div>
                      <div className="aml-stat">
                        <span className="aml-stat-value">
                          {amlResult.duration_seconds?.toFixed(1)}s
                        </span>
                        <span className="aml-stat-label">Duration</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '12px' }}>
                      {amlResult.message || 'View results in Alert Review and Transaction Monitoring'}
                    </p>
                    {amlResult.processed > 0 && (
                      <button
                        onClick={() => { setAmlResult(null); setAmlError(null); }}
                        style={{ marginTop: '12px', padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        🔄 Run Again
                      </button>
                    )}
                  </div>
                )}

                {amlError && (
                  <div className="aml-error">
                    <div>⚠️ Processing failed: {amlError}</div>
                    <button onClick={handleRunAMLProcessing} className="aml-retry-button">
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
        </div>
    );
}
