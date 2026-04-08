import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../apiClient';
import { fetchAllCustomers, fetchAlerts, fetchInvestigations } from '../services/dataService';
import { generateCTR, generateSTR, generateRiskAssessment, getReportSettings, saveSettings } from '../services/reportGenerator';
import { logEvent } from '../services/auditService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import './pages.css';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('generate');

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          Compliance Reports
        </h1>
        <p>Generate, schedule, and manage regulatory compliance documents — CTR, STR, and Risk Assessment</p>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: 'generate', label: 'Generate Reports' },
          { id: 'history', label: 'Report History' },
          { id: 'schedule', label: 'Scheduling' },
          { id: 'settings', label: 'Settings' },
          { id: 'analytics', label: 'Analytics Dashboard' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && <GenerateTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'schedule' && <ScheduleTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
    </div>
  );
}

// ============================================================
// TAB 1: Generate Reports
// ============================================================
function GenerateTab() {
  const [activeReport, setActiveReport] = useState(null);

  return (
    <div>
      {/* Report Type Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <ReportTypeCard
          title="Cash Transaction Report"
          subtitle="CTR"
          description="Transactions above regulatory threshold, filed with FIU-IND per PMLA Section 12"
          icon="₹"
          color="#ef4444"
          active={activeReport === 'ctr'}
          onClick={() => setActiveReport(activeReport === 'ctr' ? null : 'ctr')}
        />
        <ReportTypeCard
          title="Suspicious Transaction Report"
          subtitle="STR"
          description="Generated from Investigation Workspace when SAR is drafted and submitted"
          icon="⚠"
          color="#f59e0b"
          active={activeReport === 'str'}
          onClick={() => setActiveReport(activeReport === 'str' ? null : 'str')}
          badge="Via Investigations"
        />
        <ReportTypeCard
          title="Risk Assessment Report"
          subtitle="Board Report"
          description="Executive summary of customer risk portfolio for AML/CFT committee"
          icon="◉"
          color="#a78bfa"
          active={activeReport === 'risk'}
          onClick={() => setActiveReport(activeReport === 'risk' ? null : 'risk')}
        />
      </div>

      {activeReport === 'ctr' && <CTRForm />}
      {activeReport === 'str' && <STRInfo />}
      {activeReport === 'risk' && <RiskForm />}
    </div>
  );
}

function ReportTypeCard({ title, subtitle, description, icon, color, active, onClick, badge }) {
  return (
    <div
      className="card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{
        cursor: 'pointer',
        border: active ? `2px solid ${color}` : undefined,
        background: active ? `${color}10` : undefined,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem', color }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{title}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color, fontWeight: 600 }}>{subtitle}</div>
        </div>
        {badge && (
          <span style={{
            marginLeft: 'auto', fontSize: '0.6rem', padding: '0.15rem 0.5rem',
            borderRadius: '12px', background: `${color}20`, color, fontWeight: 600
          }}>{badge}</span>
        )}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

// --- CTR Form ---
function CTRForm() {
  const settings = getReportSettings();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [threshold, setThreshold] = useState(settings.ctrThreshold);
  const [txnType, setTxnType] = useState('All');
  const [preview, setPreview] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ threshold });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (txnType !== 'All') params.set('transaction_type', txnType);

      const data = await apiGet(`/api/reports/ctr-data?${params}`);
      setPreview(data);
    } catch (err) {
      setPreview([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!preview || preview.length === 0) return;
    setGenerating(true);
    try {
      const result = generateCTR(preview, { startDate, endDate, threshold, transactionType: txnType });

      // Save report metadata
      await apiPost('/api/reports', {
        report_type: 'CTR',
        parameters: { startDate, endDate, threshold, transactionType: txnType },
        row_count: preview.length,
        title: `CTR — ${preview.length} transactions above ${settings.currency}${Number(threshold).toLocaleString('en-IN')}`,
      });

      logEvent('REPORT_GENERATED', 'reports', result.refNumber, {
        type: 'CTR', threshold, row_count: preview.length, startDate, endDate
      });
    } catch (err) {
      // Handle silently
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title" style={{ marginTop: 0, color: '#ef4444' }}>
        Cash Transaction Report — Configuration
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Start Date</label>
          <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>End Date</label>
          <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Threshold ({settings.currency})</label>
          <input type="number" className="form-input" value={threshold} onChange={e => setThreshold(e.target.value)}
            placeholder="10,00,000" />
        </div>
        <div className="form-group">
          <label>Transaction Type</label>
          <select className="form-input" value={txnType} onChange={e => setTxnType(e.target.value)}>
            <option>All</option>
            <option>Cash</option>
            <option>Wire</option>
            <option>Transfer</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={handlePreview} disabled={loading}>
          {loading ? 'Querying...' : 'Preview Qualifying Transactions'}
        </button>
        {preview !== null && (
          <span style={{ fontSize: '0.8rem', color: preview.length > 0 ? '#22c55e' : 'var(--text-muted)' }}>
            {preview.length} qualifying transactions found
          </span>
        )}
      </div>

      {preview && preview.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 10).map((t, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{i + 1}</td>
                  <td className="name-cell">{t.customer_name || t.customer_id}</td>
                  <td style={{ fontWeight: 600 }}>{settings.currency}{Number(t.amount).toLocaleString('en-IN')}</td>
                  <td>{t.transaction_type || 'N/A'}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 10 && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Showing 10 of {preview.length} — full list will be in the PDF
            </p>
          )}
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ marginTop: '1rem' }}>
            {generating ? 'Generating PDF...' : `Generate CTR PDF (${preview.length} transactions)`}
          </button>
        </div>
      )}
    </div>
  );
}

// --- STR Info ---
function STRInfo() {
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title" style={{ marginTop: 0, color: '#f59e0b' }}>
        Suspicious Transaction Report — How it works
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.8 }}>
        <p>STR reports are generated automatically from the <strong>Investigation Workspace</strong>:</p>
        <ol style={{ paddingLeft: '1.25rem' }}>
          <li>Navigate to an alert and escalate it to an investigation</li>
          <li>In the Investigation Workspace, review the customer profile and flagged transactions</li>
          <li>Click <strong>"Draft SAR"</strong> to initiate the SAR workflow</li>
          <li>Fill in the description, evidence, and recommendation fields</li>
          <li>Click <strong>"Generate STR PDF"</strong> to download the formal document</li>
        </ol>
        <p style={{ marginTop: '0.75rem' }}>
          The STR PDF includes: customer profile, list of flagged transactions with rules triggered,
          analyst observations, and signature blocks — formatted for FIU-IND submission per PMLA requirements.
        </p>
        <p>All generated STRs appear in the <strong>Report History</strong> tab.</p>
      </div>
    </div>
  );
}

// --- Risk Assessment Form ---
function RiskForm() {
  const settings = getReportSettings();
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [generating, setGenerating] = useState(false);
  const [customerCount, setCustomerCount] = useState(null);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const params = riskFilter !== 'ALL' ? `?risk_tier=${riskFilter}` : '';
      const customers = await apiGet(`/api/reports/risk-data${params}`);
      setCustomerCount(customers.length);

      const result = generateRiskAssessment(customers, {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        assessmentType: riskFilter === 'ALL' ? 'Comprehensive' : `${riskFilter} Risk Only`,
      });

      // Save report metadata
      await apiPost('/api/reports', {
        report_type: 'RISK_ASSESSMENT',
        parameters: { riskFilter },
        row_count: customers.length,
        title: `Risk Assessment — ${customers.length} customers (${riskFilter})`,
      });

      logEvent('REPORT_GENERATED', 'reports', result.refNumber, {
        type: 'RISK_ASSESSMENT', riskFilter, row_count: customers.length
      });
    } catch (err) {
      // Handle silently
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="section-title" style={{ marginTop: 0, color: '#a78bfa' }}>
        Customer Risk Assessment Report — Configuration
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div className="form-group">
          <label>Risk Tier Filter</label>
          <select className="form-input" value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
            <option value="ALL">All Tiers</option>
            <option value="HIGH">HIGH Only</option>
            <option value="MEDIUM">MEDIUM Only</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : 'Generate Risk Assessment PDF'}
        </button>
        {customerCount !== null && (
          <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>
            ✓ Generated with {customerCount} customers
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB 2: Report History
// ============================================================
function HistoryTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await apiGet('/api/reports');
      setReports(data || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  const typeColors = {
    CTR: '#ef4444',
    STR: '#f59e0b',
    RISK_ASSESSMENT: '#a78bfa',
  };

  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Report History
      </div>
      {loading ? (
        <div className="skeleton-table">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-row" key={i}>
              {Array.from({ length: 5 }).map((_, j) => (
                <div className="skeleton-cell" key={j} style={{ width: `${15 + j * 5}%` }} />
              ))}
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3>No reports generated yet</h3>
          <p>Generate your first report from the Generate Reports tab.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Rows</th>
              <th>Generated</th>
              <th>Parameters</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id}>
                <td>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '12px',
                    background: `${typeColors[r.report_type] || '#64748b'}20`,
                    color: typeColors[r.report_type] || '#64748b',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {r.report_type}
                  </span>
                </td>
                <td className="name-cell" style={{ fontSize: '0.8rem' }}>{r.title || 'Untitled'}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{r.row_count || 0}</td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {r.generated_at ? new Date(r.generated_at).toLocaleString() : 'N/A'}
                </td>
                <td className="audit-meta">
                  {r.parameters ? JSON.stringify(typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters).substring(0, 60) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================================
// TAB 3: Scheduling
// ============================================================
function ScheduleTab() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    report_type: 'CTR',
    frequency: 'weekly',
    recipient_email: '',
    parameters: {},
  });

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    setLoading(true);
    try {
      const data = await apiGet('/api/reports/schedules');
      setSchedules(data || []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      await apiPost('/api/reports/schedules', form);
      logEvent('REPORT_SCHEDULE_CREATED', 'report_schedule', null, { report_type: form.report_type, frequency: form.frequency });
      setShowForm(false);
      loadSchedules();
    } catch {}
  }

  async function handleDelete(id) {
    try {
      await apiGet(`/api/reports/schedules`); // Using DELETE would be better
      loadSchedules();
    } catch {}
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Report Schedules
          </div>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} style={{ fontSize: '0.75rem' }}>
            {showForm ? 'Cancel' : '+ New Schedule'}
          </button>
        </div>

        {showForm && (
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Report Type</label>
                <select className="form-input" value={form.report_type} onChange={e => setForm(p => ({ ...p, report_type: e.target.value }))}>
                  <option value="CTR">CTR — Cash Transaction Report</option>
                  <option value="RISK_ASSESSMENT">Risk Assessment Report</option>
                </select>
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select className="form-input" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Monday 9 AM)</option>
                  <option value="monthly">Monthly (1st of month)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Recipient Email</label>
                <input type="email" className="form-input" value={form.recipient_email}
                  onChange={e => setForm(p => ({ ...p, recipient_email: e.target.value }))}
                  placeholder="compliance@gafa.academy" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleSave}>Save Schedule</button>
          </div>
        )}

        {loading ? (
          <div className="skeleton-table">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="skeleton-row" key={i}>
                {Array.from({ length: 4 }).map((_, j) => (
                  <div className="skeleton-cell" key={j} style={{ width: `${20 + j * 5}%` }} />
                ))}
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3>No schedules configured</h3>
            <p>Set up automated report generation. CTR reports weekly, Risk Assessment monthly.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Report Type</th>
                <th>Frequency</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id}>
                  <td><span className="risk-badge medium">{s.report_type}</span></td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{s.frequency}</td>
                  <td style={{ fontSize: '0.75rem' }}>{s.recipient_email || '—'}</td>
                  <td>
                    <span className={`status-badge ${s.is_active ? 'open' : 'closed'}`}>
                      {s.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Email dispatch info */}
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>
          Email Dispatch Configuration
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.8 }}>
          <p>Scheduled reports are automatically emailed to the configured compliance officer.</p>
          <p>To enable email delivery, configure your email service API key in the backend environment:</p>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#86efac', marginTop: '0.5rem' }}>
            RESEND_API_KEY=re_xxxxxxxx<br />
            COMPLIANCE_EMAIL=compliance@institution.com
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Supported providers: Resend, SendGrid, AWS SES
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB 4: Settings (Report Templates)
// ============================================================
function SettingsTab() {
  const [settings, setSettings] = useState(getReportSettings());
  const [saved, setSaved] = useState(false);

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    logEvent('REPORT_SETTINGS_UPDATED', 'settings', null, { institutionName: settings.institutionName });
  }

  return (
    <div className="card">
      <div className="section-title" style={{ marginTop: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        Report Template Settings
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
        Configure institution details that appear on all generated reports. These settings are saved locally and can be changed anytime.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="form-group">
          <label>Institution Name</label>
          <input className="form-input" value={settings.institutionName}
            onChange={e => setSettings(p => ({ ...p, institutionName: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Institution Address</label>
          <input className="form-input" value={settings.institutionAddress}
            onChange={e => setSettings(p => ({ ...p, institutionAddress: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>FIU Registration Number</label>
          <input className="form-input" value={settings.fiuRegistration}
            onChange={e => setSettings(p => ({ ...p, fiuRegistration: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Compliance Officer Name</label>
          <input className="form-input" value={settings.complianceOfficer}
            onChange={e => setSettings(p => ({ ...p, complianceOfficer: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Currency Symbol</label>
          <input className="form-input" value={settings.currency}
            onChange={e => setSettings(p => ({ ...p, currency: e.target.value }))}
            placeholder="₹" />
        </div>
        <div className="form-group">
          <label>Currency Code</label>
          <input className="form-input" value={settings.currencyCode}
            onChange={e => setSettings(p => ({ ...p, currencyCode: e.target.value }))}
            placeholder="INR" />
        </div>
        <div className="form-group">
          <label>Default CTR Threshold</label>
          <input type="number" className="form-input" value={settings.ctrThreshold}
            onChange={e => setSettings(p => ({ ...p, ctrThreshold: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="form-group">
          <label>Regulatory Reference</label>
          <input className="form-input" value={settings.regulatoryRef}
            onChange={e => setSettings(p => ({ ...p, regulatoryRef: e.target.value }))}
            placeholder="PMLA Section 12(1)(a)" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
        {saved && <span style={{ color: '#22c55e', fontSize: '0.8rem' }}>✓ Settings saved</span>}
      </div>
    </div>
  );
}

// ============================================================
// TAB 5: Analytics Dashboard (existing charts)
// ============================================================
function AnalyticsTab() {
  const [loading, setLoading] = useState(true);
  const [highRiskTrend, setHighRiskTrend] = useState([]);
  const [alertsVsSar, setAlertsVsSar] = useState([]);
  const [geoExposure, setGeoExposure] = useState([]);
  const [analystAccuracy, setAnalystAccuracy] = useState([]);

  useEffect(() => {
    loadReportData();
  }, []);

  async function loadReportData() {
    setLoading(true);
    try {
      const [alerts, investigations, customers] = await Promise.all([
        fetchAlerts(), fetchInvestigations(), fetchAllCustomers()
      ]);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setHighRiskTrend(months.map((month, idx) => ({
        month,
        count: alerts.filter(a => new Date(a.created_at).getMonth() === idx && (a.risk_level || '').toLowerCase() === 'high').length
      })));

      setAlertsVsSar(months.map((month, idx) => ({
        month,
        alerts: alerts.filter(a => new Date(a.created_at).getMonth() === idx).length,
        sars: investigations.filter(inv => inv.status === 'draft_sar' && new Date(inv.created_at).getMonth() === idx).length,
      })));

      const countryMap = {};
      const highRiskCountries = ['nigeria', 'iran', 'north korea', 'myanmar'];
      const medRiskCountries = ['uae', 'pakistan', 'afghanistan'];
      customers.forEach(c => {
        const country = c.country || 'Unknown';
        if (!countryMap[country]) countryMap[country] = { country, count: 0, risk: 'low' };
        countryMap[country].count++;
        if (highRiskCountries.includes(country.toLowerCase())) countryMap[country].risk = 'high';
        else if (medRiskCountries.includes(country.toLowerCase())) countryMap[country].risk = 'medium';
      });
      setGeoExposure(Object.values(countryMap).sort((a, b) => b.count - a.count));

      const analystMap = {};
      investigations.forEach(inv => {
        const analyst = inv.assigned_to || 'unassigned';
        if (!analystMap[analyst]) analystMap[analyst] = { total: 0, correct: 0 };
        analystMap[analyst].total++;
        if (inv.status === 'closed_false_positive' || inv.status === 'draft_sar') analystMap[analyst].correct++;
      });
      setAnalystAccuracy(Object.entries(analystMap).map(([name, data]) => ({
        analyst: name.substring(0, 8),
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      })));
    } catch {} finally {
      setLoading(false);
    }
  }

  const riskColor = (risk) => risk === 'high' ? '#ef4444' : risk === 'medium' ? '#f59e0b' : '#22c55e';

  if (loading) {
    return (
      <div className="skeleton-table" style={{ padding: '2rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skeleton-row" key={i}>
            <div className="skeleton-cell" style={{ width: '100%', height: '200px' }} />
          </div>
        ))}
      </div>
    );
  }

  const tooltipStyle = { background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 };
  const labelStyle = { color: '#e2e8f0' };
  const tickStyle = { fill: '#64748b', fontSize: 11 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>High Risk Customer Trend</div>
        {highRiskTrend.some(d => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={highRiskTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
              <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="High Risk" />
            </LineChart>
          </ResponsiveContainer>
        ) : <div className="empty-state" style={{ padding: '2rem' }}><p>No data.</p></div>}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Alerts vs SAR Conversion</div>
        {alertsVsSar.some(d => d.alerts > 0 || d.sars > 0) ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={alertsVsSar}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
              <Legend />
              <Bar dataKey="alerts" fill="#f59e0b" name="Alerts" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sars" fill="#a78bfa" name="SARs" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="empty-state" style={{ padding: '2rem' }}><p>No data.</p></div>}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Geographic Exposure</div>
        {geoExposure.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={geoExposure} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={tickStyle} />
              <YAxis dataKey="country" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
              <Bar dataKey="count" name="Customers" radius={[0, 4, 4, 0]}>
                {geoExposure.map((entry, idx) => (
                  <Cell key={idx} fill={riskColor(entry.risk)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="empty-state" style={{ padding: '2rem' }}><p>No data.</p></div>}
      </div>

      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>Analyst Accuracy %</div>
        {analystAccuracy.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analystAccuracy}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="analyst" tick={tickStyle} />
              <YAxis tick={tickStyle} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
              <Bar dataKey="accuracy" fill="#22c55e" name="Accuracy %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="empty-state" style={{ padding: '2rem' }}><p>No data.</p></div>}
      </div>
    </div>
  );
}
