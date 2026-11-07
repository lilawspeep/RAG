import { useState } from 'react';
import { Archive, MailOpen } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { getSupabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/format';
import type { ContactMessage } from '../../lib/types';
import { Badge, Notice, Spinner } from '../../components/ui';
import { dbErrorMessage, useRows } from './EntityManager';

type Status = ContactMessage['status'];
const tone: Record<Status, 'blue' | 'neutral' | 'gold'> = { new: 'blue', read: 'neutral', archived: 'gold' };

export default function Messages() {
  const { t, lang } = useI18n();
  const m = t.admin.messagesPage;
  const [filter, setFilter] = useState<Status | 'all'>('new');
  const { rows, error, reload } = useRows<ContactMessage>('contact_messages', '*', { column: 'created_at', ascending: false }, filter === 'all' ? undefined : { status: filter });
  const [actionError, setActionError] = useState<string | null>(null);

  const setStatus = async (id: string, status: Status) => {
    const sb = await getSupabase();
    const res = await sb?.from('contact_messages').update({ status }).eq('id', id);
    setActionError(res?.error ? dbErrorMessage(res.error, t.common.errorGeneric) : null);
    reload();
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-lg font-bold text-navy">{t.admin.messages}</h2>
        <div role="group" aria-label={t.common.status} className="flex gap-1 rounded-xl bg-mist p-1">
          {(['new', 'read', 'archived', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={filter === s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === s ? 'bg-white text-navy shadow-sm' : 'text-muted hover:text-navy'}`}
            >
              {s === 'all' ? t.common.all : m.statuses[s]}
            </button>
          ))}
        </div>
      </div>
      {(error || actionError) && <Notice tone="error" className="m-4">{actionError ?? error}</Notice>}
      {rows === null ? (
        <div className="p-6"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">{m.empty}</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((msg) => (
            <li key={msg.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-navy">
                    <span dir="auto">{msg.subject}</span>
                    <Badge tone={tone[msg.status]}>{m.statuses[msg.status]}</Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    <span dir="auto">{msg.name}</span> · <a className="underline" href={`mailto:${msg.email}`} dir="ltr">{msg.email}</a> · {m.received}: {formatDateTime(msg.created_at, lang)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {msg.status === 'new' && (
                    <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setStatus(msg.id, 'read')}>
                      <MailOpen className="size-4" aria-hidden /> {m.markRead}
                    </button>
                  )}
                  {msg.status !== 'archived' && (
                    <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setStatus(msg.id, 'archived')}>
                      <Archive className="size-4" aria-hidden /> {m.archive}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink" dir="auto">{msg.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
