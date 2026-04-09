import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import './LoginPage.css'; // Reuse auth styles

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');

    const { login, error: authError, clearError, user, userRole } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!email.trim() || !password.trim()) {
            setLocalError('Credentials required for clearance.');
            return;
        }

        setIsSubmitting(true);
        try {
            // Force admin role check after login, but login doesn't take role natively,
            // we will let them login, then if they aren't admin, log them out or just rely on backend.
            const result = await login(email, password);
            
            // If we successfully login, we go to dashboard. The Protected routes will handle them.
            navigate('/dashboard', { replace: true });
        } catch (err) {
            // Handled by AuthError
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayError = localError || authError;

    return (
        <div className="auth-page" style={{ background: '#030712' }}>
            <div className="auth-card glass-panel" style={{ border: '1px solid rgba(245, 158, 11, 0.2)', boxShadow: '0 0 40px rgba(245, 158, 11, 0.05)' }}>
                <div className="auth-header">
                    <div className="auth-logo" style={{ color: '#f59e0b' }}>
                        <Shield size={48} />
                    </div>
                    <h2 style={{ color: '#f59e0b', margin: '1rem 0 0.5rem' }}>RESTRICTED ACCESS</h2>
                    <p className="auth-subtitle">GAFA Systems Administrator Portal</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '2rem' }}>
                    {displayError && (
                        <div className="auth-error glass-card" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            <AlertCircle size={18} />
                            <span>{displayError}</span>
                        </div>
                    )}

                    <div className="gafa-input-group">
                        <label style={{ color: '#9ca3af' }}>Administrator Email</label>
                        <input 
                            className="gafa-input"
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@gafa.org"
                            style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}
                            required
                        />
                    </div>

                    <div className="gafa-input-group">
                        <label style={{ color: '#9ca3af' }}>Passkey</label>
                        <div className="password-input">
                            <input 
                                className="gafa-input"
                                type={showPassword ? 'text' : 'password'} 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                                style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}
                                required
                            />
                            <button 
                                type="button" 
                                className="toggle-eye"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="gafa-btn full-width"
                        disabled={isSubmitting}
                        style={{ 
                            background: '#f59e0b', 
                            color: '#000', 
                            fontWeight: 800, 
                            marginTop: '2rem',
                            border: 'none'
                        }}
                    >
                        {isSubmitting ? 'Authenticating...' : 'INITIATE OVERRIDE'}
                        {!isSubmitting && <Lock size={18} />}
                    </button>
                </form>
            </div>
        </div>
    );
}
