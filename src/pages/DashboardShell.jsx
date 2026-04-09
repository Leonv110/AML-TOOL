import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, LayoutDashboard, Users, UserCheck, Activity, 
  AlertCircle, Briefcase, FileText, Upload, History, LogOut, Settings
} from 'lucide-react';
import './DashboardShell.css';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/customers', label: 'Customers', icon: <Users size={18} /> },
  { path: '/screening', label: 'Screening', icon: <UserCheck size={18} /> },
  { path: '/transactions', label: 'Transactions', icon: <Activity size={18} /> },
  { path: '/alerts', label: 'Alerts', icon: <AlertCircle size={18} /> },
  { path: '/investigations', label: 'Investigations', icon: <Briefcase size={18} /> },
  { path: '/reports', label: 'Reports', icon: <FileText size={18} /> },
  { path: '/ingestion', label: 'Ingestion', icon: <Upload size={18} /> },
];

export default function DashboardShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="dashboard-layout">
      <div className="liquid-bg" />
      
      {/* Sidebar navigation */}
      <aside className="dash-sidebar glass-panel">
        <div className="sidebar-brand">
          <img src="/logo.png" alt="GAFA Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          <div className="brand-text">
            <h2>GAFA</h2>
            <span>AML Tool</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
              {isActive(item.path) && <div className="active-dot" />}
            </Link>
          ))}
          
          {/* Admin link only for admins */}
          {userRole === 'admin' && (
            <>
              <div className="nav-divider" style={{height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0'}} />
              <Link 
                to="/admin-portal" 
                className={`nav-link admin-link ${isActive('/admin-portal') ? 'active' : ''}`}
              >
                <Settings size={18} />
                <span>Admin Portal</span>
              </Link>
              <Link 
                to="/audit-log" 
                className={`nav-link ${isActive('/audit-log') ? 'active' : ''}`}
              >
                <History size={18} />
                <span>Audit Logs</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile glass-card">
            <div className="user-avatar">{user?.email?.[0].toUpperCase()}</div>
            <div className="user-meta">
              <p className="u-email">{user?.email}</p>
              <p className="u-role">{userRole}</p>
            </div>
          </div>
          <button className="gafa-btn logout-action" onClick={logout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dash-main-scroll">
        <header className="content-header">
           <div className="breadcrumb">
              <span>Platform</span> / <span>{NAV_ITEMS.find(n => n.path === location.pathname)?.label || 'System'}</span>
           </div>
           <div className="header-status">
              <span className="pulse-dot" />
              <span>Network Secure</span>
           </div>
        </header>
        <div className="content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
