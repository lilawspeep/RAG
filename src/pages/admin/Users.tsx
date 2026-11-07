import { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDate } from '../../lib/format';
import type { AppRole, Profile } from '../../lib/types';
import { Badge, NA, Notice, Spinner } from '../../components/ui';
import { useRows } from './EntityManager';

export default function Users() {
  const { t, lang } = useI18n();
  const u = t.admin.usersPage;
  const { rows, error } = useRows<Profile & { user_roles: { role: AppRole }[] }>('profiles', '*, user_roles(role)', { column: 'created_at', ascending: false });
  const [q, setQ] = useState('');
  const visible = useMemo(() => {
    const nq = q.trim().toLowerCase();
    if (!rows || !nq) return rows;
    return rows.filter((r) => [r.full_name, r.email, r.university_id].some((v) => v?.toLowerCase().includes(nq)));
  }, [rows, q]);

  return (
    <>
      <Notice tone="info">
        <span className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {u.roleHint}
        </span>
      </Notice>
      {error && <Notice tone="error">{error}</Notice>}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-navy">{t.admin.users}</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" aria-label={t.common.search} placeholder={t.common.search} className="input w-56 py-2 ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {visible === null ? (
          <div className="p-6"><Spinner /></div>
        ) : visible.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">{u.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-mist text-xs text-muted">
                <tr>
                  {[t.auth.fullName, t.auth.email, t.auth.universityId, t.auth.faculty, u.role, u.registered].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-start font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-mist/50">
                    <td className="px-4 py-2.5 font-semibold text-navy">{r.full_name || <NA />}</td>
                    <td className="px-4 py-2.5" dir="ltr">{r.email ?? <NA />}</td>
                    <td className="px-4 py-2.5" dir="ltr">{r.university_id ?? <NA />}</td>
                    <td className="px-4 py-2.5">{r.faculty_text ?? <NA />}</td>
                    <td className="px-4 py-2.5">
                      {r.user_roles.map(({ role }) => (
                        <Badge key={role} tone={role === 'admin' ? 'gold' : 'neutral'}>{role}</Badge>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.created_at, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
