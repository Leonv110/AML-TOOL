import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './DashboardShell.css';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/customer-master', label: 'Customer Master' },
  { path: '/customers', label: 'Customers' },
  { path: '/screening', label: 'Screening' },
  { path: '/transactions', label: 'Transactions' },
  { path: '/alerts', label: 'Alert Review' },
  { path: '/investigations', label: 'Investigations' },
  { path: '/reports', label: 'Reports' },
  { path: '/ingestion', label: 'Data Ingestion' },
  { path: '/audit-log', label: 'Audit Log' },
];

export default function DashboardShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, logout, sessionWarning, sessionTimeLeft, resetSessionTimer } = useAuth();

  function isActive(path) {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  }

  return (
    <div className="dashboard-shell">
      {/* Session warning overlay */}
      {sessionWarning && (
        <div className="session-warning-overlay">
          <div className="session-warning-card">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3>Session Expiring</h3>
            <p>Your session will expire due to inactivity</p>
            <div className="countdown">{sessionTimeLeft}s</div>
            <button className="extend-btn" onClick={resetSessionTimer} aria-label="Extend session">
              Extend Session
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="dash-header">
        <div className="dash-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label="Go to dashboard">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>GAFA</span>
        </div>

        {/* Navigation */}
        <nav className="dash-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive(item.path) ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dash-user">
          <div className="user-info">
            <span className="user-email">{user?.email}</span>
            <span className="user-role">{userRole || 'User'}</span>
          </div>
          <button className="logout-btn" onClick={logout} aria-label="Logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      {/* Main content — renders child routes */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
