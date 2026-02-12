import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
    auth,
    isConfigured,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    onAuthStateChanged
} from '../firebase';

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

    // --- Firebase auth listener ---
    useEffect(() => {
        if (!isConfigured || !auth) {
            // Firebase not configured — set loading to false so UI renders
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // --- Auth methods ---
    const login = async (email, password, rememberMe = false) => {
        if (!isConfigured || !auth) {
            const msg = 'Firebase is not configured. Please add your Firebase credentials to the .env file.';
            setError(msg);
            throw new Error(msg);
        }

        setError(null);
        try {
            await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (err) {
            const message = getErrorMessage(err.code);
            setError(message);
            throw new Error(message);
        }
    };

    const signup = async (email, password) => {
        if (!isConfigured || !auth) {
            const msg = 'Firebase is not configured. Please add your Firebase credentials to the .env file.';
            setError(msg);
            throw new Error(msg);
        }

        setError(null);
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (err) {
            const message = getErrorMessage(err.code);
            setError(message);
            throw new Error(message);
        }
    };

    const logout = async () => {
        clearTimers();
        if (!auth) return;
        try {
            await firebaseSignOut(auth);
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

function getErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'Invalid email address format.',
        'auth/user-disabled': 'This account has been disabled by an administrator.',
        'auth/user-not-found': 'No account found with this email address.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/too-many-requests': 'Too many failed attempts. Account temporarily locked.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
        'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    };
    return messages[code] || 'Authentication failed. Please try again.';
}
