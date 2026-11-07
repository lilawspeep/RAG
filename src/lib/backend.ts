const TOKEN_KEY = 'aq-token';

export const apiBase = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const isApiConfigured = apiBase.length > 0;

export interface ApiUser {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  university_id: string | null;
  role: 'student' | 'admin';
  faculty: string | null;
  major: string | null;
  created_at: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('unreachable'), { code: 'functions_unreachable' });
  }
  if (!res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      detail = typeof data.detail === 'string' ? data.detail : '';
    } catch {
      /* empty */
    }
    throw Object.assign(new Error(detail || res.statusText), { code: detail || 'error' });
  }
  return res.json() as Promise<T>;
}
