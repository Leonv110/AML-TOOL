import { useState, useEffect } from 'react';
import { 
  Activity, Server, Database, Brain, Cpu, HardDrive, 
  Terminal, AlertTriangle, CheckCircle2, RefreshCw, BarChart,
  Users, UserPlus, Shield, Eye, EyeOff
} from 'lucide-react';
import { apiGet } from '../apiClient';
import { fetchAdminUsers, adminCreateUser, adminUpdateUserRole } from '../services/dataService';
import './AdminPanel.css';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('monitor');
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

  // User Management State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'student' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await apiGet('/api/admin/health-check');
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
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const data = await fetchAdminUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      await adminCreateUser(newUser);
      setCreateSuccess(`User "${newUser.email}" created successfully with role "${newUser.role}".`);
      setNewUser({ email: '', password: '', role: 'student' });
      setShowCreateForm(false);
      loadUsers();
    } catch (err) {
      setCreateError(err?.message || err?.error || 'Failed to create user. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await adminUpdateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  }

  const roleCounts = {
    admin: users.filter(u => u.role === 'admin').length,
    investigator: users.filter(u => u.role === 'investigator').length,
    student: users.filter(u => u.role === 'student').length,
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="title-group">
          <h1>Admin Portal</h1>
          <p>System health, user management, and platform configuration</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`gafa-btn glass-card tab-toggle ${activeTab === 'monitor' ? 'active-toggle' : ''}`}
            onClick={() => setActiveTab('monitor')}
          >
            <Server size={16} /> System Monitor
          </button>
          <button 
            className={`gafa-btn glass-card tab-toggle ${activeTab === 'users' ? 'active-toggle' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={16} /> User Management
          </button>
        </div>
      </header>

      {/* ===== TAB 1: System Monitor ===== */}
      {activeTab === 'monitor' && (
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
      )}

      {/* ===== TAB 2: User Management ===== */}
      {activeTab === 'users' && (
        <div className="user-mgmt-section">
          {/* Role Summary Cards */}
          <div className="role-summary-row">
            <div className="glass-panel role-summary-card">
              <Shield size={24} className="role-icon admin-icon" />
              <div className="role-count">{roleCounts.admin}</div>
              <div className="role-label">Admins</div>
            </div>
            <div className="glass-panel role-summary-card">
              <Users size={24} className="role-icon investigator-icon" />
              <div className="role-count">{roleCounts.investigator}</div>
              <div className="role-label">Investigators</div>
            </div>
            <div className="glass-panel role-summary-card">
              <Users size={24} className="role-icon student-icon" />
              <div className="role-count">{roleCounts.student}</div>
              <div className="role-label">Students</div>
            </div>
            <div className="glass-panel role-summary-card total-card">
              <Users size={24} className="role-icon" />
              <div className="role-count">{users.length}</div>
              <div className="role-label">Total Users</div>
            </div>
          </div>

          {/* Create User Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#e2e8f0', fontSize: '1.2rem', fontWeight: 800 }}>Managed Users</h2>
            <button 
              className="gafa-btn glass-card create-user-btn"
              onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(''); setCreateSuccess(''); }}
            >
              <UserPlus size={16} /> {showCreateForm ? 'Cancel' : 'Create User'}
            </button>
          </div>

          {/* Success / Error Messages */}
          {createSuccess && (
            <div className="user-msg success-msg">
              <CheckCircle2 size={16} /> {createSuccess}
            </div>
          )}
          {createError && (
            <div className="user-msg error-msg">
              <AlertTriangle size={16} /> {createError}
            </div>
          )}

          {/* Create User Form */}
          {showCreateForm && (
            <div className="glass-panel create-user-form-card">
              <div className="card-header">
                <UserPlus size={20} />
                <h2>Create New User Account</h2>
              </div>
              <form onSubmit={handleCreateUser} className="create-user-form">
                <div className="form-row">
                  <div className="form-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="user@gafa.org"
                      value={newUser.email}
                      onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label>Password</label>
                    <div className="password-input-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Min 6 characters"
                        value={newUser.password}
                        onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Designated Role</label>
                    <select
                      value={newUser.role}
                      onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}
                    >
                      <option value="student">Student</option>
                      <option value="investigator">Investigator</option>
                      <option value="exam">Exam</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="gafa-btn submit-btn" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Users Table */}
          <div className="glass-panel users-table-card">
            {loadingUsers ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gafa-text-dim)' }}>
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gafa-text-dim)' }}>
                No users found. Create your first user above.
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td className="user-email-cell">{u.email}</td>
                      <td>
                        <span className={`role-pill ${u.role || 'student'}`}>
                          {(u.role || 'student').toUpperCase()}
                        </span>
                      </td>
                      <td className="date-cell">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      </td>
                      <td>
                        <select
                          className="role-select"
                          value={u.role || 'student'}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="student">Student</option>
                          <option value="investigator">Investigator</option>
                          <option value="exam">Exam</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
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
