import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    onAuthStateChanged
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if Firebase config is properly set up
const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key_here';

let app = null;
let auth = null;

if (isConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
    } catch (error) {
        console.error('Firebase initialization failed:', error);
    }
}

if (!isConfigured) {
    console.warn(
        '%c⚠️ Firebase not configured',
        'color: #f59e0b; font-weight: bold; font-size: 14px;',
        '\n\nTo enable authentication, create a .env file in the project root with your Firebase credentials.',
        '\nSee .env.example for the required variables.'
    );
}

export {
    auth,
    isConfigured,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    onAuthStateChanged
};

export default app;
