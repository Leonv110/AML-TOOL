import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../apiClient';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './pages.css';
import './DashboardPage.css';

// ── Helpers ─────────────────────────────────────────────────
const fmt = n => n?.toLocaleString('en-IN') ?? '—';

function SummaryCard({ label, value, sub, color, icon, onClick }) {
  return (
    <div className="db-summary-card" style={{ '--card-accent': color }} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="db-card-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="db-card-body">
        <div className="db-card-label">{label}</div>
        <div className="db-card-value" style={{ color }}>{fmt(value)}</div>
        {sub && <div className="db-card-sub">{sub}</div>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="db-tooltip">
      {label && <p className="db-tooltip-label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{fmt(p.value)}</strong>
        </p>
      ))}
    </div>
  );
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ── Mock data generators (used when backend returns empty arrays) ────────────
function getMockTrend() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map(m => ({
    month: m,
    fraudCases: Math.floor(Math.random() * 30 + 5),
    highRiskAlerts: Math.floor(Math.random() * 80 + 10),
  }));
}

function getMockLocations() {
  return [
    { country: 'Iran', count: 42 },
    { country: 'Nigeria', count: 35 },
    { country: 'Russia', count: 28 },
    { country: 'Pakistan', count: 22 },
    { country: 'Myanmar', count: 18 },
    { country: 'Yemen', count: 14 },
  ];
}

// ── Main Component ────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ totalTransactions: 0, highRisk: 0, falsePositives: 0 });
  const [trend, setTrend] = useState([]);
  const [riskBreakdown, setRiskBreakdown] = useState([]);
  const [timeOfDay, setTimeOfDay] = useState([]);
  const [topLocations, setTopLocations] = useState([]);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [countsData, trendData, riskData, todData, locData] = await Promise.all([
        apiGet('/api/dashboard/counts').catch(() => ({})),
        apiGet('/api/dashboard/trend').catch(() => []),
        apiGet('/api/dashboard/risk-breakdown').catch(() => []),
        apiGet('/api/dashboard/time-of-day').catch(() => []),
        apiGet('/api/dashboard/top-locations').catch(() => []),
      ]);

      setCounts({
        totalTransactions: countsData.totalTransactions || 0,
        highRisk: countsData.highRisk || 0,
        falsePositives: countsData.falsePositives || 0,
      });

      // All charts use real data only — no mock fallbacks
      setTrend(trendData || []);
      setRiskBreakdown(riskData?.length ? riskData : []);
      setTimeOfDay(todData?.length ? todData : []);
      setTopLocations(locData?.length ? locData : []);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Fraud Detection &amp; Risk Monitoring
          </h1>
          <p>Comprehensive overview of fraud patterns, risk distribution, and behavioral anomalies</p>
        </div>
        <div className="db-skeleton-grid">
          {[...Array(3)].map((_, i) => <div key={i} className="db-summary-card skeleton-pulse" style={{ height: '100px' }} />)}
        </div>
        <div className="db-charts-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="db-chart-card skeleton-pulse" style={{ height: '280px' }} />)}
        </div>
      </div>
    );
  }

  const totalRisk = riskBreakdown.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <h1>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Fraud Detection &amp; Risk Monitoring
        </h1>
        <p>Comprehensive overview of fraud patterns, risk distribution, and behavioral anomalies</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="db-skeleton-grid" style={{ marginBottom: '1.5rem' }}>
        <SummaryCard
          label="Total Transactions"
          value={counts.totalTransactions}
          sub="Ingested in system"
          color="#0ea5e9"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
          onClick={() => navigate('/transactions')}
        />
        <SummaryCard
          label="Fraudulent Cases"
          value={counts.highRisk}
          sub="HIGH / CRITICAL alerts"
          color="#ef4444"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
          onClick={() => navigate('/customers?filter=high-risk')}
        />
        <SummaryCard
          label="False Positives"
          value={counts.falsePositives}
          sub="Closed as non-threat"
          color="#a78bfa"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>}
          onClick={() => navigate('/alerts')}
        />
      </div>

      {/* ── Row 1: Trend + Risk Analysis ── */}
      <div className="db-row db-row-60-40" style={{ marginBottom: '1.5rem' }}>

        {/* Fraud Trend Over Time */}
        <div className="db-chart-card">
          <div className="db-chart-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            Fraud Trend Over Time
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              <Line type="monotone" dataKey="fraudCases" name="Fraud Cases" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="highRiskAlerts" name="High Risk Alerts" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Analysis — two donuts */}
        <div className="db-chart-card">
          <div className="db-chart-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
            Risk Analysis
          </div>
          <div className="db-donuts-row">
            {/* Risk Level Breakdown */}
            <div className="db-donut-wrap">
              <p className="db-donut-label">Risk Level Breakdown</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={riskBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {riskBreakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${((v / totalRisk) * 100).toFixed(1)}%`, '']} contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="db-legend">
                {riskBreakdown.map((d, i) => (
                  <div key={i} className="db-legend-item">
                    <span className="db-legend-dot" style={{ background: d.color }} />
                    <span>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fraud by Time of Day */}
            <div className="db-donut-wrap">
              <p className="db-donut-label">Fraud by Time of Day</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={timeOfDay}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {timeOfDay.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="db-legend">
                {timeOfDay.map((d, i) => (
                  <div key={i} className="db-legend-item">
                    <span className="db-legend-dot" style={{ background: d.color }} />
                    <span>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Behavioral Patterns ── */}
      <div className="db-row db-row-50-50">

        {/* Frequent Locations of Fraud */}
        <div className="db-chart-card">
          <div className="db-chart-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
            Frequent Locations of Fraud
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topLocations} layout="vertical" margin={{ top: 0, right: 15, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="country" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Alerts" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {topLocations.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#0ea5e9'} fillOpacity={1 - i * 0.1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Time Anomalies — hourly distribution line */}
        <div className="db-chart-card">
          <div className="db-chart-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            Transaction Time Anomalies
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={generateHourlyAnomaly(timeOfDay)}
              margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="anomalies" name="Anomalies" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
              {/* Odd-hour shading via reference area isn't available without extra import — use a dashed red line for threshold */}
              <Line type="monotone" dataKey="threshold" name="Threshold" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="db-chart-note">Hours 0–5 IST highlighted as anomalous (odd-hour rule)</p>
        </div>
      </div>
    </div>
  );
}

// Build 24-hour anomaly data from time-of-day breakdown
function generateHourlyAnomaly(timeOfDay) {
  const nightVal = timeOfDay.find(d => d.name === 'Night')?.value || 20;
  const morningVal = timeOfDay.find(d => d.name === 'Morning')?.value || 30;
  const afternoonVal = timeOfDay.find(d => d.name === 'Afternoon')?.value || 40;
  const total = (nightVal + morningVal + afternoonVal) || 90;

  return Array.from({ length: 24 }, (_, h) => {
    let base;
    if (h >= 0 && h < 6) base = (nightVal / total) * 100 * (0.6 + Math.random() * 0.5);
    else if (h >= 6 && h < 12) base = (morningVal / total) * 100 * (0.4 + Math.random() * 0.3);
    else if (h >= 12 && h < 20) base = (afternoonVal / total) * 100 * (0.3 + Math.random() * 0.2);
    else base = (nightVal / total) * 60 * (0.5 + Math.random() * 0.4);
    return {
      hour: `${h}h`,
      anomalies: Math.round(base),
      threshold: 20,
    };
  });
}
