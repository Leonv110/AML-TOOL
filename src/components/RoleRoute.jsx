import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RoleRoute({ allowed = [], children }) {
    const { user, userRole, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-screen" style={{ height: '100%', minHeight: '300px' }}>
                <div className="loading-spinner" />
                <p className="loading-text">Verifying Access Level...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!allowed.includes(userRole)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
