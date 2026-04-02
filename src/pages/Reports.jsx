import { useState, useEffect } from 'react';
import { fetchAllCustomers, fetchTransactionsForCustomer, computeRiskScore, fetchAlerts, fetchInvestigations } from '../services/dataService';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import './pages.css';

export default function Reports() {
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
        fetchAlerts(),
        fetchInvestigations(),
        fetchAllCustomers()
      ]);

      // Chart 1: High Risk Customer Trend
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const trendData = months.map((month, idx) => {
        const monthAlerts = alerts.filter(a => {
          const d = new Date(a.created_at);
          return d.getMonth() === idx && (a.risk_level || '').toLowerCase() === 'high';
        });
        return { month, count: monthAlerts.length };
      });
      setHighRiskTrend(trendData);

      // Chart 2: Alerts vs SAR Conversion
      const avsData = months.map((month, idx) => {
        const monthAlerts = alerts.filter(a => new Date(a.created_at).getMonth() === idx);
        const monthSars = investigations.filter(inv =>
          inv.status === 'draft_sar' && new Date(inv.created_at).getMonth() === idx
        );
        return { month, alerts: monthAlerts.length, sars: monthSars.length };
      });
      setAlertsVsSar(avsData);

      // Chart 3: Geographic Exposure
      const countryMap = {};
      const highRiskCountries = ['nigeria', 'iran', 'north korea', 'myanmar'];
      const medRiskCountries = ['uae', 'pakistan', 'afghanistan'];

      alerts.forEach(a => {
        if (!a.customer_id) return;
        // Use customer_name as proxy for country from alert data
      });

      // Build from customers
      customers.forEach(c => {
        const country = c.country || 'Unknown';
        if (!countryMap[country]) countryMap[country] = { country, count: 0, risk: 'low' };
        countryMap[country].count++;
        if (highRiskCountries.includes(country.toLowerCase())) countryMap[country].risk = 'high';
        else if (medRiskCountries.includes(country.toLowerCase())) countryMap[country].risk = 'medium';
      });
      const geoData = Object.values(countryMap).sort((a, b) => b.count - a.count);
      setGeoExposure(geoData);

      // Chart 4: Analyst Accuracy
      // Placeholder with sample data structure
      const analystMap = {};
      investigations.forEach(inv => {
        const analyst = inv.assigned_to || 'unassigned';
        if (!analystMap[analyst]) analystMap[analyst] = { total: 0, correct: 0 };
        analystMap[analyst].total++;
        if (inv.status === 'closed_false_positive' || inv.status === 'draft_sar') {
          analystMap[analyst].correct++;
        }
      });
      const accuracyData = Object.entries(analystMap).map(([name, data]) => ({
        analyst: name.substring(0, 8),
        accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      }));
      setAnalystAccuracy(accuracyData);
    } catch (err) {
      // Handle silently
    } finally {
      setLoading(false);
    }
  }

  const riskColor = (risk) => {
    if (risk === 'high') return '#ef4444';
    if (risk === 'medium') return '#f59e0b';
    return '#22c55e';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="loading-spinner-sm" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
          Reports
        </h1>
        <p>Executive compliance dashboards and analytics</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Chart 1: High Risk Customer Trend */}
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>High Risk Customer Trend</div>
          {highRiskTrend.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={highRiskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} name="High Risk Customers" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No high risk trend data available yet.</p>
            </div>
          )}
        </div>

        {/* Chart 2: Alerts vs SAR Conversion */}
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Alerts vs SAR Conversion</div>
          {alertsVsSar.some(d => d.alerts > 0 || d.sars > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={alertsVsSar}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="alerts" fill="#f59e0b" name="Total Alerts" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sars" fill="#a78bfa" name="SARs Drafted" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No alert or SAR data available yet.</p>
            </div>
          )}
        </div>

        {/* Chart 3: Geographic Exposure */}
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Geographic Exposure</div>
          {geoExposure.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={geoExposure} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis dataKey="country" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" name="Customers" radius={[0, 4, 4, 0]}>
                  {geoExposure.map((entry, idx) => (
                    <Cell key={idx} fill={riskColor(entry.risk)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No geographic data available yet.</p>
            </div>
          )}
        </div>

        {/* Chart 4: Analyst Accuracy */}
        <div className="card">
          <div className="section-title" style={{ marginTop: 0 }}>Analyst Accuracy %</div>
          {analystAccuracy.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analystAccuracy}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="analyst" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="accuracy" fill="#22c55e" name="Accuracy %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>No analyst performance data available yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Power BI / Tableau Embed */}
      <PowerBIEmbed />
    </div>
  );
}

function PowerBIEmbed() {
  const envUrl = import.meta.env.VITE_POWERBI_EMBED_URL;
  const [embedUrl, setEmbedUrl] = useState(envUrl || '');
  const [activeUrl, setActiveUrl] = useState(envUrl || '');

  if (activeUrl) {
    return (
      <div style={{ width: '100%', marginTop: '1.5rem', background: '#0d1117', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1e293b' }}>
        <iframe
          src={activeUrl}
          width="100%"
          height="600px"
          frameBorder="0"
          allowFullScreen
          title="Power BI Dashboard"
        />
      </div>
    );
  }

  return (
    <div className="powerbi-placeholder" style={{ marginTop: '1.5rem', background: '#0f172a', padding: '2rem', borderRadius: '8px', border: '1px dashed #334155', textAlign: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.3, marginBottom: '1rem', color: '#94a3b8' }}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#f1f5f9' }}>Power BI / Tableau Dashboard</p>
      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 1rem' }}>
        Paste embed URL below to display dashboard
      </p>
      <div style={{ display: 'flex', gap: '8px', maxWidth: '600px', margin: '0 auto' }}>
        <input
          type="url"
          value={embedUrl}
          onChange={(e) => setEmbedUrl(e.target.value)}
          placeholder="Paste Power BI or Tableau embed URL here..."
          style={{ flex: 1, padding: '10px 12px', background: '#0d1117', border: '1px solid #1e293b', color: '#f1f5f9', fontSize: '13px', borderRadius: '4px' }}
        />
        <button
          onClick={() => setActiveUrl(embedUrl)}
          style={{ padding: '10px 16px', background: '#f59e0b', color: '#050709', fontWeight: '700', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
        >
          Load Dashboard
        </button>
      </div>
    </div>
  );
}
