import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './DashboardShell.css';

const MODULES = [
    {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'Overview of key metrics, alerts, and compliance status',
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
        status: 'Coming Soon',
    },
    {
        id: 'risk-analysis',
        title: 'Customer Risk Analysis',
        description: 'Evaluate and score customer risk profiles for AML compliance',
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6M23 11h-6" />
            </svg>
        ),
        status: 'Coming Soon',
    },
    {
        id: 'monitoring',
        title: 'Transaction Monitoring',
        description: 'Real-time transaction surveillance and pattern detection',
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
        status: 'Coming Soon',
    },
    {
        id: 'alert-review',
        title: 'Alert Review',
        description: 'Investigate and disposition system-generated compliance alerts',
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
        ),
        status: 'Coming Soon',
    },
    {
        id: 'sar-workshop',
        title: 'SAR Workshop',
        description: 'Draft and submit Suspicious Activity Reports for regulators',
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
        status: 'Coming Soon',
    },
    {
        id: 'ingestion',
        title: 'Data Ingestion',
        description: 'Upload and parse Excel datasets with field mapping',
        icon: (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
            </svg>
        ),
        status: 'Coming Soon',
    },
];

export default function DashboardShell() {
    const navigate = useNavigate();
    const { user, userRole, logout, sessionWarning, sessionTimeLeft, resetSessionTimer } = useAuth();

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
                        <button className="extend-btn" onClick={resetSessionTimer}>
                            Extend Session
                        </button>
                    </div>
                </div>
            )}

            {/* Top bar */}
            <header className="dash-header">
                <div className="dash-brand">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>GAFA</span>
                </div>
                <div className="dash-user">
                    <div className="user-info">
                        <span className="user-email">{user?.email}</span>
                        <span className="user-role">{userRole || 'User'}</span>
                    </div>
                    <button className="logout-btn" onClick={logout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Logout
                    </button>
                </div>
            </header>

            {/* Main content */}
            <main className="dash-main">
                <div className="welcome-section">
                    <h1>Welcome{userRole ? `, ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}` : ''}</h1>
                    <p>Select a module to begin your forensic analysis workflow</p>
                </div>

                <div className="modules-grid">
                    {MODULES.map(mod => (
                        <div
                            key={mod.id}
                            className="module-card"
                            onClick={() => mod.id === 'ingestion' && navigate('/ingestion')}
                            style={{ cursor: mod.id === 'ingestion' ? 'pointer' : 'default' }}
                        >
                            <div className="module-icon">{mod.icon}</div>
                            <h3>{mod.title}</h3>
                            <p>{mod.description}</p>
                            <span className={`module-status ${mod.id === 'ingestion' ? 'active' : ''}`}>
                                {mod.id === 'ingestion' ? 'Active' : mod.status}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="system-status">
                    <div className="status-item">
                        <span className="status-dot active" />
                        <span>Authentication: Active</span>
                    </div>
                    <div className="status-item">
                        <span className="status-dot active" />
                        <span>Data Ingestion: Active</span>
                    </div>
                    <div className="status-item">
                        <span className="status-dot pending" />
                        <span>OFAC Screening: Pending Build</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
