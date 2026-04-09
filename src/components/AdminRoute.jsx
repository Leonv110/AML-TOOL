import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }) {
    const { user, userRole, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen" style={{ height: '100%', minHeight: '300px' }}>
                <div className="loading-spinner" />
                <p className="loading-text">Verifying Admin Clearance...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (userRole !== 'admin') {
        // Rediret non-admins back to the normal dashboard if they try to access /admin
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
