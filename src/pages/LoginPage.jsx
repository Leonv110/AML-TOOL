import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

const PASSWORD_RULES = [
    { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { id: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { id: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
    { id: 'special', label: 'One special character', test: (p) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function LoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('student');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');
    const [mounted, setMounted] = useState(false);
    const isLoggingInRef = useRef(false);

    const { login, signup, logout, error: authError, clearError, user, userRole } = useAuth();
    const navigate = useNavigate();

    useEffect(() => { setMounted(true); }, []);

    // Redirect if already logged in (skip during active login attempt)
    useEffect(() => {
        if (user && !isLoggingInRef.current) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    // Password strength score
    const strengthScore = PASSWORD_RULES.filter(r => r.test(password)).length;
    const strengthLabel = ['', 'Weak', 'Weak', 'Fair', 'Strong', 'Excellent'][strengthScore];
    const strengthClass = ['', 'weak', 'weak', 'fair', 'strong', 'excellent'][strengthScore];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        // Validation
        if (!email.trim() || !password.trim()) {
            setLocalError('All fields are required.');
            return;
        }

        if (isSignup) {
            if (strengthScore < 4) {
                setLocalError('Password does not meet security requirements.');
                return;
            }
            if (password !== confirmPassword) {
                setLocalError('Passwords do not match.');
                return;
            }
        }

        setIsSubmitting(true);
        isLoggingInRef.current = true;
        try {
            if (isSignup) {
                await signup(email, password, role);
            } else {
                const result = await login(email, password, rememberMe);
                // Check role from the freshly-fetched profile, not stale React state
                if (role && result.role && result.role !== role) {
                    setLocalError('Role mismatch: your account does not have the selected role.');
                    await logout();
                    setIsSubmitting(false);
                    isLoggingInRef.current = false;
                    return;
                }
            }
            navigate('/dashboard', { replace: true });
        } catch {
            // Error is handled by AuthContext
        } finally {
            isLoggingInRef.current = false;
            setIsSubmitting(false);
        }
    };

    const toggleMode = () => {
        setIsSignup(!isSignup);
        setLocalError('');
        clearError();
        setPassword('');
        setConfirmPassword('');
    };

    const displayError = localError || authError;

    return (
        <div className={`login-page ${mounted ? 'mounted' : ''}`}>
            {/* Animated background */}
            <div className="bg-grid" />
            <div className="bg-particles">
                {Array.from({ length: 30 }, (_, i) => (
                    <div key={i} className="particle" style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 8}s`,
                        animationDuration: `${6 + Math.random() * 8}s`,
                        opacity: 0.1 + Math.random() * 0.3,
                        width: `${2 + Math.random() * 3}px`,
                        height: `${2 + Math.random() * 3}px`,
                    }} />
                ))}
            </div>
            <div className="bg-scanline" />

            {/* Security banner */}
            <div className="security-banner">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>RESTRICTED ACCESS — AUTHORIZED PERSONNEL ONLY</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            </div>

            {/* Login card */}
            <div className={`login-card ${mounted ? 'card-enter' : ''}`}>
                {/* Header */}
                <div className="card-header">
                    <div className="logo-container">
                        <div className="logo-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="M12 8v4" />
                                <circle cx="12" cy="16" r="1" fill="currentColor" />
                            </svg>
                        </div>
                        <div className="logo-text">
                            <h1>GAFA</h1>
                            <p className="subtitle">Global Anti-Financial Crime Academy</p>
                        </div>
                    </div>
                    <div className="status-line">
                        <span className="status-dot" />
                        <span className="status-text">System Active • Secure Connection</span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form" noValidate>
                    <h2 className="form-title">
                        {isSignup ? 'Register' : 'Login'}
                    </h2>

                    {displayError && (
                        <div className="error-message" role="alert">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4M12 16h.01" />
                            </svg>
                            <span>{displayError}</span>
                        </div>
                    )}

                    {/* Role selector */}
                    <div className="input-group">
                        <label htmlFor="role">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a5 5 0 00-5 5v2H6a2 2 0 00-2 2v3h16v-3a2 2 0 00-2-2h-1V7a5 5 0 00-5-5z" />
                                <circle cx="12" cy="14" r="4" />
                            </svg>
                            Role
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            disabled={isSubmitting}
                        >
                            <option value="student">Student</option>
                            <option value="admin">Admin/Trainer</option>
                            <option value="exam">Exam Access</option>
                        </select>
                    </div>

                    {/* Email */}
                    <div className="input-group">
                        <label htmlFor="email">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="M22 4l-10 8L2 4" />
                            </svg>
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="investigator@agency.gov"
                            autoComplete="email"
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    {/* Password */}
                    <div className="input-group">
                        <label htmlFor="password">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            Password
                        </label>
                        <div className="password-wrapper">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete={isSignup ? 'new-password' : 'current-password'}
                                disabled={isSubmitting}
                                required
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                                        <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Password strength (signup only) */}
                    {isSignup && password.length > 0 && (
                        <div className="password-strength">
                            <div className="strength-bar-bg">
                                <div
                                    className={`strength-bar-fill ${strengthClass}`}
                                    style={{ width: `${(strengthScore / 5) * 100}%` }}
                                />
                            </div>
                            <span className={`strength-label ${strengthClass}`}>
                                {strengthLabel}
                            </span>
                            <ul className="password-rules">
                                {PASSWORD_RULES.map(rule => (
                                    <li key={rule.id} className={rule.test(password) ? 'pass' : 'fail'}>
                                        <span className="rule-icon">{rule.test(password) ? '✓' : '○'}</span>
                                        {rule.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Confirm password (signup only) */}
                    {isSignup && (
                        <div className="input-group">
                            <label htmlFor="confirmPassword">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4" />
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0110 0v4" />
                                </svg>
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="new-password"
                                disabled={isSubmitting}
                                required
                            />
                        </div>
                    )}

                    {/* Remember me (login only) */}
                    {!isSignup && (
                        <div className="options-row">
                            <label className="checkbox-label" htmlFor="rememberMe">
                                <input
                                    id="rememberMe"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    disabled={isSubmitting}
                                />
                                <span className="checkbox-custom" />
                                <span>Remember this device</span>
                            </label>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        className={`submit-btn ${isSubmitting ? 'loading' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="btn-spinner" />
                                <span>{isSignup ? 'Creating Account...' : 'Authenticating...'}</span>
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                                    <polyline points="10 17 15 12 10 7" />
                                    <line x1="15" y1="12" x2="3" y2="12" />
                                </svg>
                                <span>{isSignup ? 'Register Account' : 'Secure Login'}</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Toggle signup/login */}
                <div className="toggle-mode">
                    <span>{isSignup ? 'Already registered?' : 'New user?'}</span>
                    <button type="button" onClick={toggleMode} disabled={isSubmitting}>
                        {isSignup ? 'Sign in here' : 'Register account'}
                    </button>
                </div>

                {/* Compliance footer */}
                <div className="compliance-footer">
                    <div className="compliance-line" />
                    <p>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        This system is for authorized use only. All access is logged and monitored
                        in accordance with AML/CFT regulatory requirements. Unauthorized access
                        is a criminal offense under applicable law.
                    </p>
                    <p className="session-info">
                        Session Timeout: 30 min • Encryption: AES-256 • Protocol: TLS 1.3
                    </p>
                </div>
            </div>

            {/* Build info */}
            <div className="build-info">
                <span>GAFA v1.0.0</span>
                <span className="separator">•</span>
                <span>Global Anti-Financial Crime Academy</span>
                <span className="separator">•</span>
                <span>© 2026 GAFA</span>
            </div>
        </div>
    );
}
