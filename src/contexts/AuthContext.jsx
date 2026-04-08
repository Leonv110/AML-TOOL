import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authLogin, authSignup, authGetMe, authLogout, isAuthenticated, getToken } from '../apiClient';
import { logEvent } from '../services/auditService';

const AuthContext = createContext(null);

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;   // warn 5 min before timeout

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sessionWarning, setSessionWarning] = useState(false);
    const [sessionTimeLeft, setSessionTimeLeft] = useState(null);

    const timeoutRef = useRef(null);
    const warningRef = useRef(null);
    const countdownRef = useRef(null);

    // --- Session timeout logic ---
    const clearTimers = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setSessionWarning(false);
        setSessionTimeLeft(null);
    }, []);

    const startSessionTimer = useCallback(() => {
        clearTimers();

        // Warning timer
        warningRef.current = setTimeout(() => {
            setSessionWarning(true);
            let timeLeft = WARNING_BEFORE_MS;
            setSessionTimeLeft(Math.floor(timeLeft / 1000));
            countdownRef.current = setInterval(() => {
                timeLeft -= 1000;
                setSessionTimeLeft(Math.floor(timeLeft / 1000));
                if (timeLeft <= 0) clearInterval(countdownRef.current);
            }, 1000);
        }, SESSION_TIMEOUT_MS - WARNING_BEFORE_MS);

        // Actual timeout
        timeoutRef.current = setTimeout(() => {
            logout();
        }, SESSION_TIMEOUT_MS);
    }, [clearTimers]);

    const resetSessionTimer = useCallback(() => {
        if (user) startSessionTimer();
    }, [user, startSessionTimer]);

    // Reset on user activity
    useEffect(() => {
        if (!user) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        const handler = () => resetSessionTimer();

        events.forEach(e => window.addEventListener(e, handler, { passive: true }));
        startSessionTimer();

        return () => {
            events.forEach(e => window.removeEventListener(e, handler));
            clearTimers();
        };
    }, [user, resetSessionTimer, startSessionTimer, clearTimers]);

    // --- Check for existing session on mount ---
    useEffect(() => {
        async function checkSession() {
            if (!isAuthenticated()) {
                setLoading(false);
                return;
            }

            try {
                const data = await authGetMe();
                setUser(data.user);
                setUserRole(data.role);
            } catch (err) {
                // Token is invalid or expired
                authLogout();
                setUser(null);
                setUserRole(null);
            }
            setLoading(false);
        }

        checkSession();
    }, []);

    // --- Auth methods ---
    const login = async (email, password, rememberMe = false) => {
        setError(null);
        try {
            const data = await authLogin(email, password);
            setUser(data.user);
            setUserRole(data.role);
            logEvent('AUTH_LOGIN', 'user', data.user?.id || data.user?.email, { email: data.user?.email, role: data.role });
            return { user: data.user, role: data.role };
        } catch (err) {
            const message = getErrorMessage(err.message);
            setError(message);
            throw new Error(message);
        }
    };

    const signup = async (email, password, role = 'student') => {
        setError(null);
        try {
            const data = await authSignup(email, password, role);
            setUser(data.user);
            setUserRole(data.role);
            return data.user;
        } catch (err) {
            const message = getErrorMessage(err.message);
            setError(message);
            throw new Error(message);
        }
    };

    const logout = async () => {
        logEvent('AUTH_LOGOUT', 'user', user?.id || user?.email, { email: user?.email });
        clearTimers();
        authLogout();
        setUser(null);
        setUserRole(null);
    };

    const clearError = () => setError(null);

    const value = {
        user,
        userRole,
        loading,
        error,
        sessionWarning,
        sessionTimeLeft,
        isConfigured: true, // Always configured (no Supabase check needed)
        login,
        signup,
        logout,
        clearError,
        resetSessionTimer
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

function getErrorMessage(message) {
    const lowerMsg = (message || '').toLowerCase();

    if (lowerMsg.includes('invalid login')) return 'Invalid email or password. Please try again.';
    if (lowerMsg.includes('email not confirmed')) return 'Please confirm your email address before logging in.';
    if (lowerMsg.includes('user already registered')) return 'An account with this email already exists.';
    if (lowerMsg.includes('password')) return 'Password must be at least 6 characters.';
    if (lowerMsg.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
    if (lowerMsg.includes('network')) return 'Network error. Please check your connection.';
    if (lowerMsg.includes('signup is disabled')) return 'New registrations are currently disabled.';

    return message || 'Authentication failed. Please try again.';
}
