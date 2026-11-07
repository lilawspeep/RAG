import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

let service: SupabaseClient | null = null;

/** Service-role client. Server-side only; bypasses RLS, so every caller must authorize first. */
export function serviceClient(): SupabaseClient {
  if (!service) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
    service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return service;
}

export async function getUser(req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  return error ? null : data.user;
}

/** Roles come from the user_roles table (writable only by the service role), never from client claims. */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await serviceClient().from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  return !!data;
}
