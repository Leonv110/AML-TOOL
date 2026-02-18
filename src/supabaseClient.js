import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is properly configured
const isConfigured = supabaseUrl && supabaseAnonKey
    && supabaseUrl !== 'your_supabase_url'
    && supabaseAnonKey !== 'your_supabase_anon_key';

let supabase = null;

if (isConfigured) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.warn(
        '⚠️ Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
    );
}

export { supabase, isConfigured };
