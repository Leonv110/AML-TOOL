import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import './IngestionPage.css';

export default function IngestionPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [mode, setMode] = useState('append'); // 'append' or 'replace'
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState(null);
    const [preview, setPreview] = useState(null); // { columns: [], rows: [], totalRows: number }
    const fileInputRef = useRef(null);

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
            if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
                setStatus({ type: 'error', message: 'Please upload a valid Excel file (.xlsx or .xls)' });
                return;
            }
            setFile(selectedFile);
            setStatus(null);
            setProgress(0);

            // Auto-parse for preview
            try {
                const parsed = await parseExcel(selectedFile);
                if (parsed.length > 0) {
                    setPreview({
                        columns: Object.keys(parsed[0]),
                        rows: parsed.slice(0, 5),
                        totalRows: parsed.length,
                    });
                }
            } catch {
                setPreview(null);
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
            if (!droppedFile.name.match(/\.(xlsx|xls)$/)) {
                setStatus({ type: 'error', message: 'Please upload a valid Excel file (.xlsx or .xls)' });
                return;
            }
            setFile(droppedFile);
            setStatus(null);
            setProgress(0);

            // Auto-parse for preview
            try {
                const parsed = await parseExcel(droppedFile);
                if (parsed.length > 0) {
                    setPreview({
                        columns: Object.keys(parsed[0]),
                        rows: parsed.slice(0, 5),
                        totalRows: parsed.length,
                    });
                }
            } catch {
                setPreview(null);
            }
        }
    };

    const handleUpload = async () => {
        if (!file || !user) return;

        setUploading(true);
        setStatus(null);
        setProgress(10);

        try {
            // 1. Parse Excel File
            const parsedData = await parseExcel(file);
            setProgress(30);

            if (parsedData.length === 0) {
                throw new Error('Excel file is empty');
            }

            // 2. Prepare Data for Supabase (user.id for Supabase Auth)
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
                // AML output columns — always start clean; aml_processor.py will populate these
                flagged:                      false,
                flag_reason:                  null,
                rule_triggered:               null,
                risk_score:                   null,
            }));

            setProgress(50);

            // 3. Handle 'Replace' Mode
            if (mode === 'replace') {
                const { error: deleteError } = await supabase
                    .from('transactions')
                    .delete()
                    .neq('transaction_id', ''); // Delete all rows

                if (deleteError) throw deleteError;
            }

            setProgress(70);

            // 4. Batch insert (1000 rows per batch)
            const batchSize = 1000;
            for (let i = 0; i < formattedData.length; i += batchSize) {
                const batch = formattedData.slice(i, i + batchSize);
                const { error: insertError } = await supabase
                    .from('transactions')
                    .insert(batch);

                if (insertError) throw insertError;

                // Update progress proportionally
                const batchProgress = 70 + Math.round((i / formattedData.length) * 30);
                setProgress(Math.min(batchProgress, 99));
            }

            setProgress(100);
            setStatus({ type: 'success', message: `Successfully ingested ${formattedData.length} records.` });
            setFile(null);
            setPreview(null);

        } catch (error) {
            console.error('Upload failed:', error);
            setStatus({
                type: 'error',
                message: error.message || 'Failed to upload data. Please check your file format.'
            });
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
    };

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
                <div className="upload-options">
                    <button
                        className={`option-btn ${mode === 'append' ? 'active' : ''}`}
                        onClick={() => setMode('append')}
                    >
                        Append to Existing
                    </button>
                    <button
                        className={`option-btn ${mode === 'replace' ? 'active' : ''}`}
                        onClick={() => setMode('replace')}
                    >
                        Replace All Data
                    </button>
                </div>

                {!file ? (
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
                )}

                {/* Column Preview — shows after file selection, before upload */}
                {preview && !uploading && (
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

                {uploading && (
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

                {status && (
                    <div className={`status-message ${status.type}`}>
                        {status.type === 'success' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        )}
                        <span>{status.message}</span>
                    </div>
                )}

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
            </div>
        </div>
    );
}
