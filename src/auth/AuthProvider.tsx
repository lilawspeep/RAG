import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured, requireSupabase } from '../lib/supabase';
import type { AppRole, Profile } from '../lib/types';

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  universityId?: string;
  facultyId?: string;
  majorId?: string;
  facultyText?: string;
  majorText?: string;
  preferredLanguage: 'ar' | 'en';
}

interface AuthValue {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  /** UI hint only; every privileged action is re-checked by RLS / edge functions on the server. */
  isAdmin: boolean;
  recoveryMode: boolean;
  signIn: (email: string, password: string) => Promise<{ roles: AppRole[] }>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function loadUserData(userId: string): Promise<{ profile: Profile | null; roles: AppRole[] }> {
  const sb = await requireSupabase();
  const [p, r] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('user_roles').select('role').eq('user_id', userId),
  ]);
  return {
    profile: (p.data as Profile | null) ?? null,
    roles: ((r.data as { role: AppRole }[] | null) ?? []).map((x) => x.role),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const sb = await getSupabase();
      if (!sb || !active) return;
      const { data } = sb.auth.onAuthStateChange((event, s) => {
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
        setSession(s);
        if (!s) {
          setProfile(null);
          setRoles([]);
        } else {
          // Deferred: Supabase recommends not awaiting other client calls inside this callback.
          setTimeout(() => {
            loadUserData(s.user.id).then((d) => {
              if (!active) return;
              setProfile(d.profile);
              setRoles(d.roles);
            });
          }, 0);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
      const { data: sessionData } = await sb.auth.getSession();
      if (!active) return;
      setSession(sessionData.session);
      if (sessionData.session) {
        const d = await loadUserData(sessionData.session.user.id);
        if (!active) return;
        setProfile(d.profile);
        setRoles(d.roles);
      }
      setLoading(false);
    })().catch(() => active && setLoading(false));

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = await requireSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    const d = await loadUserData(data.user.id);
    setSession(data.session);
    setProfile(d.profile);
    setRoles(d.roles);
    return { roles: d.roles };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const sb = await requireSupabase();
    // Metadata is read by the handle_new_user trigger; it never carries a role.
    const { data, error } = await sb.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: input.fullName.trim(),
          university_id: input.universityId?.trim() || null,
          faculty_id: input.facultyId || null,
          major_id: input.majorId || null,
          faculty_text: input.facultyText?.trim() || null,
          major_text: input.majorText?.trim() || null,
          preferred_language: input.preferredLanguage,
        },
      },
    });
    if (error) throw error;
    // Supabase returns a user with no identities when the email already exists (anti-enumeration).
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw Object.assign(new Error('already_registered'), { code: 'user_already_exists' });
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getSupabase();
    await sb?.auth.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const sb = await requireSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const sb = await requireSupabase();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    setRecoveryMode(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const d = await loadUserData(session.user.id);
    setProfile(d.profile);
    setRoles(d.roles);
  }, [session]);

  const value = useMemo<AuthValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isAdmin: roles.includes('admin'),
      recoveryMode,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
    }),
    [loading, session, profile, roles, recoveryMode, signIn, signUp, signOut, requestPasswordReset, updatePassword, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
