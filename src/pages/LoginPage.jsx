import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, UserPlus, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
    const [isSignup, setIsSignup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('student');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');

    const { login, signup, error: authError, clearError, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/hub', { replace: true });
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        clearError();

        if (!email.trim() || !password.trim()) {
            setLocalError('All fields are required.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (isSignup) {
                await signup(email, password, role);
            } else {
                await login(email, password);
            }
            navigate('/hub', { replace: true });
        } catch (err) {
            // Error managed by AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayError = localError || authError;

    return (
        <div className="auth-page">
            <div className="liquid-bg" />
            
            <div className="auth-grid">
                
                {/* --- Left Panel: Dynamic Information --- */}
                <div className="auth-info-panel glass-panel">
                    <div className="info-brand">
                        <img src="/logo.png" alt="GAFA Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                        <h2>Global Association of <br/> Forensic Accountants</h2>
                    </div>
                    
                    <div className="info-content">
                        <h3>Welcome to the GAFA AML Ecosystem</h3>
                        <p>Our intelligent platform is designed to give you unparalleled forensic insights, reducing false-positive rates explicitly related to multi-hop financial structuring.</p>
                        
                        <ul className="info-features">
                            <li><CheckCircle2 className="gafa-brand-green" size={20} /> Access live sandboxed data streams.</li>
                            <li><CheckCircle2 className="gafa-brand-green" size={20} /> Run ML Ensembles instantly.</li>
                            <li><CheckCircle2 className="gafa-brand-green" size={20} /> Generate SAR files automatically.</li>
                        </ul>
                    </div>

                    <div className="info-footer">
                        <p>Need support? <a href="mailto:support@gafa.org">Contact IT Services</a></p>
                    </div>
                </div>

                {/* --- Right Panel: Auth Form --- */}
                <div className="auth-form-panel glass-panel">
                    <div className="auth-header">
                        <h2>{isSignup ? 'Create Account' : 'Platform Access'}</h2>
                        <p className="auth-subtitle">Verify clearance to proceed</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-toggle">
                            <button 
                                type="button" 
                                className={!isSignup ? 'active' : ''} 
                                onClick={() => {setIsSignup(false); clearError();}}
                            >Login</button>
                            <button 
                                type="button" 
                                className={isSignup ? 'active' : ''} 
                                onClick={() => {setIsSignup(true); clearError();}}
                            >Register</button>
                        </div>

                        {displayError && (
                            <div className="auth-error glass-card">
                                <AlertCircle size={18} />
                                <span>{displayError}</span>
                            </div>
                        )}

                        <div className="gafa-input-group">
                            <label><Mail size={16} /> Email Address</label>
                            <input 
                                className="gafa-input"
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="investigator@gafa.org"
                                required
                            />
                        </div>

                        <div className="gafa-input-group">
                            <label><Lock size={16} /> Password</label>
                            <div className="password-input">
                                <input 
                                    className="gafa-input"
                                    type={showPassword ? 'text' : 'password'} 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
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

                        <div className="gafa-input-group">
                            <label>Designated Role</label>
                            <select 
                                className="gafa-input gafa-select"
                                value={role} 
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value="student">Forensic Student</option>
                                <option value="investigator">Investigator / Trainer</option>
                            </select>
                        </div>

                        <button 
                            type="submit" 
                            className="gafa-btn gafa-btn-primary full-width"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Processing...' : (isSignup ? 'Create Account' : 'Secure Sign In')}
                            {!isSubmitting && (isSignup ? <UserPlus size={18} /> : <LogIn size={18} />)}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>By accesssing this portal, you agree to our</p>
                        <div className="footer-links">
                            <Link to="/terms">Terms of Service</Link>
                            <span>•</span>
                            <Link to="/privacy">Privacy Policy</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
