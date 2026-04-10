import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Activity, UserCheck, Upload, LogOut } from 'lucide-react';
import './HubPage.css';

const MODULES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Alerts, metrics & compliance overview',
    icon: <LayoutDashboard size={32} />,
    path: '/dashboard',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.03))',
  },
  {
    id: 'transactions',
    label: 'Transaction Monitoring',
    description: 'Review and analyse transaction alerts',
    icon: <Activity size={32} />,
    path: '/transactions',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.03))',
  },
  {
    id: 'screening',
    label: 'Customer Screening',
    description: 'Sanctions, PEP & watchlist checks',
    icon: <UserCheck size={32} />,
    path: '/screening',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.03))',
  },
  {
    id: 'ingestion',
    label: 'Data Ingestion',
    description: 'Upload and manage customer data',
    icon: <Upload size={32} />,
    path: '/ingestion',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.03))',
  },
];

export default function HubPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.email?.split('@')[0] || 'User';
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="hub-page">
      <div className="hub-bg" />

      {/* Top Bar */}
      <header className="hub-topbar">
        <div className="hub-brand">
          <img src="/logo.png" alt="GAFA" className="hub-logo" />
          <div className="hub-brand-text">
            <span className="hub-brand-name">GAFA</span>
            <span className="hub-brand-sub">AML Tool</span>
          </div>
        </div>
        <div className="hub-user-section">
          <div className="hub-user-info">
            <div className="hub-user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
            <span className="hub-user-email">{user?.email || 'User'}</span>
          </div>
          <button className="hub-logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Welcome Section */}
      <div className="hub-content">
        <div className="hub-welcome">
          <h1>Welcome back, {capitalizedName}</h1>
          <p>Select a module to get started</p>
        </div>

        {/* Module Tiles */}
        <div className="hub-grid">
          {MODULES.map(mod => (
            <button
              key={mod.id}
              className="hub-tile"
              onClick={() => navigate(mod.path)}
              style={{ '--tile-color': mod.color, '--tile-gradient': mod.gradient }}
            >
              <div className="hub-tile-icon" style={{ background: mod.gradient, color: mod.color }}>
                {mod.icon}
              </div>
              <h3 className="hub-tile-label">{mod.label}</h3>
              <p className="hub-tile-desc">{mod.description}</p>
              <div className="hub-tile-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
