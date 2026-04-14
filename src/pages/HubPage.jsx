import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, UserCheck, Activity,
  AlertCircle, Briefcase, FileText, Upload,
  Settings, History, LogOut
} from 'lucide-react';
import './HubPage.css';

const MODULES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Alerts, metrics & compliance overview',
    icon: <LayoutDashboard size={28} />,
    path: '/dashboard',
    color: '#3b82f6',
  },
  {
    id: 'transactions',
    label: 'Transaction Monitoring',
    description: 'Review and analyse transaction alerts',
    icon: <Activity size={28} />,
    path: '/transactions',
    color: '#22c55e',
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Customer directory & profile management',
    icon: <Users size={28} />,
    path: '/customers',
    color: '#06b6d4',
  },
  {
    id: 'screening',
    label: 'Customer Screening',
    description: 'Sanctions, PEP & watchlist checks',
    icon: <UserCheck size={28} />,
    path: '/screening',
    color: '#f59e0b',
  },
  {
    id: 'alerts',
    label: 'Alert Review',
    description: 'Triage, escalate & resolve alerts',
    icon: <AlertCircle size={28} />,
    path: '/alerts',
    color: '#ef4444',
  },
  {
    id: 'investigations',
    label: 'Investigations',
    description: 'Case management & investigation workspace',
    icon: <Briefcase size={28} />,
    path: '/investigations',
    color: '#8b5cf6',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Generate SAR and compliance reports',
    icon: <FileText size={28} />,
    path: '/reports',
    color: '#ec4899',
  },
  {
    id: 'ingestion',
    label: 'Data Ingestion',
    description: 'Upload and manage transaction & customer data',
    icon: <Upload size={28} />,
    path: '/ingestion',
    color: '#a78bfa',
  },
];

const ADMIN_MODULES = [
  {
    id: 'admin-portal',
    label: 'Admin Portal',
    description: 'System health, resources & model performance',
    icon: <Settings size={28} />,
    path: '/admin-portal',
    color: '#f59e0b',
  },
  {
    id: 'audit-log',
    label: 'Audit Logs',
    description: 'Track all user actions and system events',
    icon: <History size={28} />,
    path: '/audit-log',
    color: '#64748b',
  },
];

export default function HubPage() {
  const navigate = useNavigate();
  const { user, userRole, logout } = useAuth();

  const displayName = user?.email?.split('@')[0] || 'User';
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const allModules = userRole === 'admin'
    ? [...MODULES, ...ADMIN_MODULES]
    : MODULES;

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
          <img src="/logo.webp" alt="GAFA" className="hub-logo" />
          <div className="hub-brand-text">
            <span className="hub-brand-name">GAFA</span>
            <span className="hub-brand-sub">AML Tool</span>
          </div>
        </div>
        <div className="hub-user-section">
          <div className="hub-user-info">
            <div className="hub-user-avatar">{user?.email?.[0]?.toUpperCase() || 'U'}</div>
            <span className="hub-user-email">{user?.email || 'User'}</span>
            {userRole && <span className="hub-user-role">{userRole}</span>}
          </div>
          <button className="hub-logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
            <span>Logout</span>
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
          {allModules.map(mod => (
            <button
              key={mod.id}
              className="hub-tile"
              onClick={() => navigate(mod.path)}
              style={{ '--tile-color': mod.color }}
            >
              <div className="hub-tile-icon" style={{ color: mod.color, background: `${mod.color}15` }}>
                {mod.icon}
              </div>
              <h3 className="hub-tile-label">{mod.label}</h3>
              <p className="hub-tile-desc">{mod.description}</p>
              <div className="hub-tile-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
