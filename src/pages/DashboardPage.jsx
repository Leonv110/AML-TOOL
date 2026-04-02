import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../apiClient';
import './pages.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, highRisk: 0, openAlerts: 0, openSAR: 0 });
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const counts = await apiGet('/api/dashboard/counts');
      
      setStats({
        total: counts.totalCustomers || 0,
        highRisk: counts.highRisk || 0,
        openAlerts: counts.openAlerts || 0,
        openSAR: counts.openSAR || 0
      });

      // Fetch Student Performance
      {
        const analystStats = await apiGet('/api/dashboard/analyst-stats');
        const studentAlerts = analystStats.alerts || [];
        const studentInvs = analystStats.investigations || [];
        
        const perfMap = {};
        (studentAlerts || []).forEach(a => {
           if (!a.assigned_to) return;
           if (!perfMap[a.assigned_to]) perfMap[a.assigned_to] = { alertsReviewed: 0, correctEscalations: 0, totalEscalations: 0, totalTime: 0 };
           perfMap[a.assigned_to].alertsReviewed++;
           
           const created = new Date(a.created_at).getTime();
           const updated = new Date(a.updated_at || a.created_at).getTime();
           perfMap[a.assigned_to].totalTime += (updated - created) / 60000; // in mins
        });
        
        (studentInvs || []).forEach(inv => {
           if (!inv.assigned_to) return;
           if (!perfMap[inv.assigned_to]) perfMap[inv.assigned_to] = { alertsReviewed: 0, correctEscalations: 0, totalEscalations: 0, totalTime: 0 };
           perfMap[inv.assigned_to].totalEscalations++;
           if (inv.status === 'closed_false_positive' || inv.status === 'draft_sar') {
              perfMap[inv.assigned_to].correctEscalations++;
           }
        });
        
        const studentData = Object.entries(perfMap).map(([id, data]) => ({
           name: id.substring(0, 8),
           alertsReviewed: data.alertsReviewed,
           accuracy: data.totalEscalations > 0 ? Math.round((data.correctEscalations / data.totalEscalations) * 100) : 0,
           avgTime: data.alertsReviewed > 0 ? Math.round(data.totalTime / data.alertsReviewed) : 0
        }));
        
        setStudents(studentData);
      }
    } catch (err) {
      // Silently handle errors for dashboard
    } finally {
      setLoading(false);
    }
  }

  function handleAlertClick(alert) {
    if (alert.case_id) {
      navigate(`/investigations/${alert.case_id}`);
    } else if (alert.customer_id) {
      navigate(`/customers/${alert.customer_id}`);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="loading-spinner-sm" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Dashboard
        </h1>
        <p>Overview of key metrics, alerts, and compliance status</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => navigate('/customers')} role="button" tabIndex={0} aria-label="Total Customers">
          <div className="kpi-label">Total Customers</div>
          <div className="kpi-value">{stats.total}</div>
        </div>
        <div className="kpi-card high" onClick={() => navigate('/customers')} role="button" tabIndex={0} aria-label="High Risk Customers">
          <div className="kpi-label">High Risk</div>
          <div className="kpi-value">{stats.highRisk}</div>
        </div>
        <div className="kpi-card alert" onClick={() => navigate('/alerts')} role="button" tabIndex={0} aria-label="Open Alerts">
          <div className="kpi-label">Open Alerts</div>
          <div className="kpi-value">{stats.openAlerts}</div>
        </div>
        <div className="kpi-card sar" onClick={() => navigate('/investigations')} role="button" tabIndex={0} aria-label="Open SAR">
          <div className="kpi-label">Open SAR</div>
          <div className="kpi-value">{stats.openSAR}</div>
        </div>
      </div>

      {/* Alert Snapshot Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Alert Snapshot
        </div>
        {alerts.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            </svg>
            <h3>No alerts yet</h3>
            <p>Alerts will appear here once transactions are monitored and flagged.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Customer</th>
                <th>Risk</th>
                <th>Rule</th>
                <th>Status</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map(alert => (
                <tr
                  key={alert.alert_id || alert.id}
                  className="clickable-row"
                  onClick={() => handleAlertClick(alert)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Alert ${alert.alert_id}`}
                >
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                    {alert.alert_id}
                  </td>
                  <td className="name-cell">{alert.customer_name || alert.customer_id}</td>
                  <td>
                    <span className={`risk-badge ${(alert.risk_level || '').toLowerCase()}`}>
                      {alert.risk_level || 'N/A'}
                    </span>
                  </td>
                  <td>{alert.rule_triggered || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${(alert.status || '').toLowerCase()}`}>
                      {alert.status || 'open'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {alert.assigned_to ? 'Assigned' : 'Unassigned'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Student Performance Table */}
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand-accent)" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path d="M20 8v6M23 11h-6" />
          </svg>
          Student Performance
        </div>
        {students.length === 0 ? (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
            </svg>
            <h3>No student data yet</h3>
            <p>Student performance metrics will be tracked once alerts are reviewed and dispositioned.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Alerts Reviewed</th>
                <th>Escalation Accuracy %</th>
                <th>Avg Time (mins)</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={i}>
                  <td className="name-cell">{s.name}</td>
                  <td>{s.alertsReviewed}</td>
                  <td>{s.accuracy}%</td>
                  <td>{s.avgTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
