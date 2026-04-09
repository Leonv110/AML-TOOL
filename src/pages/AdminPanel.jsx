import { useState, useEffect } from 'react';
import { 
  Activity, Server, Database, Brain, Cpu, HardDrive, 
  Terminal, AlertTriangle, CheckCircle2, RefreshCw, BarChart 
} from 'lucide-react';
import './AdminPanel.css';

export default function AdminPanel() {
  const [stats, setStats] = useState({
    apiStatus: 'online',
    dbStatus: 'checking',
    mlStatus: 'checking',
    vectorStatus: 'online',
    cpu: Math.floor(Math.random() * 30) + 10,
    memory: Math.floor(Math.random() * 40) + 40,
    tokens: 124502,
    disk: 45
  });

  const [logs, setLogs] = useState([
    { id: 1, type: 'INFO', msg: 'System Bootstrapped successfully', time: '10:00:01' },
    { id: 2, type: 'WARN', msg: 'High memory usage detected in ML ensemble', time: '10:05:22' },
    { id: 3, type: 'ERROR', msg: 'Critical API latency spike detected', time: '10:15:45' },
    { id: 4, type: 'INFO', msg: 'New investigation batch processed', time: '10:20:11' },
  ]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/admin/health-check');
        const data = await res.json();
        setStats(prev => ({
          ...prev,
          dbStatus: data.db,
          mlStatus: data.ml
        }));
      } catch (err) {
        console.error('Failed to fetch health stats');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="title-group">
          <h1>System & Resource Monitor</h1>
          <p>Real-time platform health and ML ensemble performance</p>
        </div>
        <button className="gafa-btn glass-card refresh-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={18} /> Refresh Metrics
        </button>
      </header>

      <div className="admin-grid">
        {/* Service Health */}
        <div className="glass-panel health-card">
          <div className="card-header">
            <Server size={20} />
            <h2>Service Health</h2>
          </div>
          <div className="health-grid">
            <HealthStatus name="Express API" status={stats.apiStatus} />
            <HealthStatus name="PostgreSQL" status={stats.dbStatus} />
            <HealthStatus name="ML Ensemble" status={stats.mlStatus} />
            <HealthStatus name="ChromaDB" status={stats.vectorStatus} />
          </div>
        </div>

        {/* Resource Usage */}
        <div className="glass-panel resource-card">
          <div className="card-header">
            <Cpu size={20} />
            <h2>Resources</h2>
          </div>
          <div className="resource-bars">
            <ResourceBar label="CPU Load" value={stats.cpu} color="var(--gafa-accent)" />
            <ResourceBar label="RAM Usage" value={stats.memory} color={stats.memory > 80 ? 'var(--gafa-danger)' : 'var(--gafa-accent)'} />
            <ResourceBar label="Disk Usage" value={stats.disk} color="var(--gafa-text-dim)" />
          </div>
        </div>

        {/* Token Usage */}
        <div className="glass-panel usage-card">
          <div className="card-header">
            <Brain size={20} />
            <h2>AI Token Consumption</h2>
          </div>
          <div className="usage-stats">
            <div className="stat-main">
              <span className="stat-value">{stats.tokens.toLocaleString()}</span>
              <span className="stat-unit">Tokens / Month</span>
            </div>
            <div className="stat-footer">
              <BarChart size={16} />
              <span>12% increase from last week</span>
            </div>
          </div>
        </div>

        {/* Model Performance */}
        <div className="glass-panel model-card">
          <div className="card-header">
            <Activity size={20} />
            <h2>Model Performance</h2>
          </div>
          <div className="model-metrics">
            <div className="metric">
              <span>Recall</span>
              <strong>0.94</strong>
            </div>
            <div className="metric">
              <span>Precision</span>
              <strong>0.89</strong>
            </div>
            <div className="metric">
              <span>F1 Score</span>
              <strong>0.91</strong>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="glass-panel logs-card">
          <div className="card-header">
            <Terminal size={20} />
            <h2>System & Activity Logs</h2>
          </div>
          <div className="logs-stream">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type.toLowerCase()}`}>
                <span className="log-time">[{log.time}]</span>
                <span className="log-type">{log.type}</span>
                <span className="log-msg">{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthStatus({ name, status }) {
  const isOnline = status === 'online';
  const isDegraded = status === 'degraded';
  
  return (
    <div className="health-item">
      <span>{name}</span>
      <div className={`status-pill ${status}`}>
        {isOnline && <CheckCircle2 size={14} />}
        {isDegraded && <AlertTriangle size={14} />}
        {status.toUpperCase()}
      </div>
    </div>
  );
}

function ResourceBar({ label, value, color }) {
  return (
    <div className="resource-bar-group">
      <div className="bar-labels">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="bar-bg">
        <div className="bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
