import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { BookOpen, ChartNoAxesColumn, Mail, MessagesSquare, Pencil, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { getSupabase } from '../lib/supabase';
import { formatDateTime } from '../lib/format';
import type { AdvisorConversation, Faculty, Major } from '../lib/types';
import { Badge, EmptyState, Field, Modal, NA, Notice, Spinner, errorProps } from '../components/ui';

export default function UserDashboard() {
  const { t, lang, pick } = useI18n();
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [conversations, setConversations] = useState<AdvisorConversation[] | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [major, setMajor] = useState<Major | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }
    let active = true;
    getSupabase().then(async (sb) => {
      if (!sb) return;
      const { data } = await sb
        .from('advisor_conversations')
        .select('id,title,created_at,updated_at')
        .order('updated_at', { ascending: false })
        .limit(8);
      if (active) setConversations(data ?? []);
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    getSupabase().then(async (sb) => {
      if (!sb || !profile) return;
      const [f, m] = await Promise.all([
        profile.faculty_id ? sb.from('faculties').select('*').eq('id', profile.faculty_id).maybeSingle() : null,
        profile.major_id ? sb.from('majors').select('*').eq('id', profile.major_id).maybeSingle() : null,
      ]);
      if (!active) return;
      setFaculty((f?.data as Faculty) ?? null);
      setMajor((m?.data as Major) ?? null);
    });
    return () => {
      active = false;
    };
  }, [profile]);

  const name = profile?.full_name?.trim();
  const facultyName = faculty ? pick(faculty.name_ar, faculty.name_en) : profile?.faculty_text;
  const majorName = major ? pick(major.name_ar, major.name_en) : profile?.major_text;

  const quick = [
    { to: '/syllabus', icon: BookOpen, title: t.user.qaSyllabus, body: t.user.qaSyllabusBody },
    { to: '/advisor', icon: Sparkles, title: t.user.qaAdvisor, body: t.user.qaAdvisorBody },
    { to: '/contact', icon: Mail, title: t.user.qaContact, body: t.user.qaContactBody },
  ];

  const rows: [string, string | null | undefined, boolean?][] = [
    [t.user.name, name],
    [t.user.email, user?.email, true],
    [t.user.universityId, profile?.university_id, true],
    [t.user.faculty, facultyName],
    [t.user.major, majorName],
  ];

  return (
    <div className="container-page py-10 sm:py-14">
      {notice === 'notAdmin' && (
        <Notice tone="warning" className="mb-6">
          {t.auth.notAdmin}
        </Notice>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-navy p-7 text-white sm:p-10">
        <div aria-hidden className="absolute -end-16 -top-16 size-64 rounded-full bg-gold/15 blur-3xl" />
        <div className="tatreez-divider absolute inset-x-0 bottom-0 opacity-40" aria-hidden />
        <p className="text-sm font-bold text-gold-light">{t.meta.university}</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{name ? t.user.welcome(name) : t.user.welcomeGeneric}</h1>
        <p className="mt-3 max-w-xl text-white/75">{t.user.welcomeBody}</p>
        {(facultyName || majorName) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {facultyName && <span className="rounded-full bg-white/10 px-3 py-1 text-sm">{facultyName}</span>}
            {majorName && <span className="rounded-full bg-gold/25 px-3 py-1 text-sm text-gold-light">{majorName}</span>}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-1" aria-labelledby="profile-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="profile-title" className="text-lg font-bold text-navy">
              {t.user.profile}
            </h2>
            {user && (
              <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden />
                {t.user.editProfile}
              </button>
            )}
          </div>
          <dl className="space-y-3 text-sm">
            {rows.map(([label, value, ltr]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-line/70 pb-3 last:border-0">
                <dt className="text-muted">{label}</dt>
                <dd className="text-end font-semibold text-navy" dir={ltr ? 'ltr' : undefined}>
                  {value || <NA />}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{t.user.role}</dt>
              <dd>
                <Badge tone={isAdmin ? 'gold' : 'blue'}>{isAdmin ? t.user.roleAdmin : t.user.roleStudent}</Badge>
              </dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="qa-title">
            <h2 id="qa-title" className="mb-3 text-lg font-bold text-navy">
              {t.user.quickActions}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {quick.map(({ to, icon: Icon, title, body }) => (
                <Link key={to} to={to} className="card group p-5 transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-lift">
                  <span className="grid size-11 place-items-center rounded-xl bg-navy text-gold-light group-hover:bg-academic">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <p className="mt-3 font-bold text-navy">{title}</p>
                  <p className="text-sm text-muted">{body}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="card p-6" aria-labelledby="conv-title">
            <h2 id="conv-title" className="mb-4 text-lg font-bold text-navy">
              {t.user.conversations}
            </h2>
            {conversations === null ? (
              <Spinner />
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={<MessagesSquare className="size-6" />}
                title={t.user.noConversations}
                action={
                  <Link to="/advisor" className="btn-primary">
                    {t.user.startConversation}
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <Link to={`/advisor?c=${c.id}`} className="flex items-center justify-between gap-4 rounded-lg px-2 py-3 hover:bg-mist">
                      <span className="truncate font-semibold text-navy" dir="auto">
                        {c.title || t.advisor.newChat}
                      </span>
                      <span className="shrink-0 text-xs text-muted">{formatDateTime(c.updated_at, lang)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6" aria-labelledby="acad-title">
            <h2 id="acad-title" className="mb-4 text-lg font-bold text-navy">
              {t.user.academicOverview}
            </h2>
            <EmptyState icon={<ChartNoAxesColumn className="size-6" />} title={t.common.notAvailable} body={t.user.noAcademicRecords} />
          </section>
        </div>
      </div>

      {editing && profile && (
        <EditProfile
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await refreshProfile();
            setEditing(false);
          }}
          initial={{ full_name: profile.full_name, university_id: profile.university_id ?? '' }}
          userId={profile.id}
        />
      )}
    </div>
  );
}

function EditProfile({
  initial,
  userId,
  onClose,
  onSaved,
}: {
  initial: { full_name: string; university_id: string };
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<{ full_name?: string; university_id?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      full_name: v.full_name.trim().length < 3 ? t.validation.minLength(3) : undefined,
      university_id: v.university_id.trim() && !/^\d{4,12}$/.test(v.university_id.trim()) ? t.validation.universityId : undefined,
    };
    setErr(errs);
    if (errs.full_name || errs.university_id) return;
    setBusy(true);
    const sb = await getSupabase();
    const { error } = (await sb
      ?.from('profiles')
      .update({ full_name: v.full_name.trim(), university_id: v.university_id.trim() || null })
      .eq('id', userId)) ?? { error: new Error('no backend') };
    setBusy(false);
    if (error) setFormError(t.common.errorGeneric);
    else onSaved();
  };

  return (
    <Modal open onClose={onClose} title={t.user.editProfile}>
      <form noValidate onSubmit={submit} className="space-y-4">
        <Field label={t.user.name} htmlFor="ep-name" error={err.full_name}>
          <input {...errorProps('ep-name', err.full_name)} className="input" value={v.full_name} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
        </Field>
        <Field label={t.user.universityId} htmlFor="ep-uid" error={err.university_id} optional>
          <input {...errorProps('ep-uid', err.university_id)} className="input" dir="ltr" inputMode="numeric" value={v.university_id} onChange={(e) => setV({ ...v, university_id: e.target.value })} />
        </Field>
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? t.common.saving : t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
