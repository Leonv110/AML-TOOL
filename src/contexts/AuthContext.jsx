import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isConfigured } from '../supabaseClient';

const AuthContext = createContext(null);

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;   // warn 5 min before timeout

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
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

    // --- Supabase auth listener ---
    useEffect(() => {
        if (!isConfigured || !supabase) {
            setLoading(false);
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // --- Auth methods ---
    const login = async (email, password, rememberMe = false) => {
        if (!isConfigured || !supabase) {
            const msg = 'Supabase is not configured. Please add your Supabase credentials to the .env file.';
            setError(msg);
            throw new Error(msg);
        }

        setError(null);
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;
            return data.user;
        } catch (err) {
            const message = getErrorMessage(err.message);
            setError(message);
            throw new Error(message);
        }
    };

    const signup = async (email, password) => {
        if (!isConfigured || !supabase) {
            const msg = 'Supabase is not configured. Please add your Supabase credentials to the .env file.';
            setError(msg);
            throw new Error(msg);
        }

        setError(null);
        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;
            return data.user;
        } catch (err) {
            const message = getErrorMessage(err.message);
            setError(message);
            throw new Error(message);
        }
    };

    const logout = async () => {
        clearTimers();
        if (!supabase) return;
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Logout error:', err);
        }
    };

    const clearError = () => setError(null);

    const value = {
        user,
        loading,
        error,
        sessionWarning,
        sessionTimeLeft,
        isConfigured,
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
