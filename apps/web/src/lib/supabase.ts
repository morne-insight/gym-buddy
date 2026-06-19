import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loudly in dev — a missing key otherwise surfaces as confusing 401s.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy apps/web/.env.example to .env.local and fill them in.',
  );
}

/**
 * Supabase is used for AUTH ONLY in this app — never for database or storage
 * reads/writes (those go through the Node server API). The session is persisted
 * to localStorage and auto-refreshed by the client.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
