import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Database, FileText, Inbox, ListChecks, MessagesSquare, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { Notice, StatCard } from '../../components/ui';

interface Stats {
  documents: number;
  indexed_documents: number;
  chunks: number;
  courses: number;
  plans: number;
  sections: number;
  users: number;
  new_messages: number;
  conversations: number;
  questions_7d: number;
  grounded_7d: number;
}

export default function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSupabase().then(async (sb) => {
      if (!sb) return;
      const { data, error: e } = await sb.rpc('admin_dashboard_stats');
      if (e) setError(true);
      else setStats(data as Stats);
    });
  }, []);

  const v = (n: number | undefined) => (stats ? (n ?? 0).toLocaleString() : '—');
  const s = t.admin.stats;
  return (
    <>
      {!isSupabaseConfigured && <Notice tone="warning">{t.admin.previewNote}</Notice>}
      {error && <Notice tone="error">{t.admin.metricsUnavailable}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={s.documents} value={v(stats?.documents)} icon={<FileText className="size-5" />} />
        <StatCard label={s.indexed} value={v(stats?.indexed_documents)} icon={<ShieldCheck className="size-5" />} />
        <StatCard label={s.chunks} value={v(stats?.chunks)} icon={<Database className="size-5" />} />
        <StatCard label={s.courses} value={v(stats?.courses)} icon={<BookOpen className="size-5" />} />
        <StatCard label={s.plans} value={v(stats?.plans)} icon={<ListChecks className="size-5" />} />
        <StatCard label={s.sections} value={v(stats?.sections)} icon={<CalendarDays className="size-5" />} />
        <StatCard label={s.users} value={v(stats?.users)} icon={<Users className="size-5" />} />
        <StatCard label={s.messages} value={v(stats?.new_messages)} icon={<Inbox className="size-5" />} />
        <StatCard label={s.conversations} value={v(stats?.conversations)} icon={<MessagesSquare className="size-5" />} />
        <StatCard label={s.questions7d} value={v(stats?.questions_7d)} icon={<Sparkles className="size-5" />} />
        <StatCard label={s.grounded7d} value={v(stats?.grounded_7d)} icon={<ShieldCheck className="size-5" />} />
      </div>
    </>
  );
}
