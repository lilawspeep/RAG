import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url));

let clientPromise: Promise<SupabaseClient | null> | null = null;

/**
 * Returns the shared Supabase client, or null when the backend is not configured.
 * The SDK is imported on demand so it stays out of the initial homepage bundle.
 */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    }),
  );
  return clientPromise;
}

/** Same as getSupabase but throws when the backend is unavailable; for code paths gated by isSupabaseConfigured. */
export async function requireSupabase(): Promise<SupabaseClient> {
  const sb = await getSupabase();
  if (!sb) throw new Error('backend_not_configured');
  return sb;
}
