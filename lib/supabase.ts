import { createClient } from '@supabase/supabase-js';
import { capacitorStorage } from '../utils/capacitorStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uuiqtfzgdisuuqtefrgb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1aXF0ZnpnZGlzdXVxdGVmcmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MTkyNTUsImV4cCI6MjA4NzI5NTI1NX0.bP9Neh8MH8yeFaHBvQ1sZwBRF1exo25syjykwRIcoFw';

/**
 * Supabase client for the Partner App.
 * - persistSession: true ensures the JWT is stored and reused.
 * - storage: capacitorStorage saves the session in Capacitor Preferences (native secure storage)
 *   instead of localStorage, which can be wiped by the OS on low memory.
 * - autoRefreshToken: true silently refreshes the token before it expires.
 * - detectSessionInUrl: false improves native performance (no URL parsing needed).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        storage: capacitorStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
    realtime: {
        heartbeatIntervalMs: 15000,
    },
});

// Helper to check if supabase is properly configured
export const isSupabaseConfigured = () => !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
