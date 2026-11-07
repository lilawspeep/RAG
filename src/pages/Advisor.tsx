import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Bot, Check, Copy, FileText, MessageSquarePlus, Send, ShieldAlert, ShieldCheck, Trash2, User } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { ApiError, invokeFunction, type AdvisorReply, type RagStatus } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { AdvisorConversation, AdvisorMessage, Citation } from '../lib/types';
import { Badge, Notice, Spinner } from '../components/ui';

const MAX_LEN = 1000;

type UiMessage = Pick<AdvisorMessage, 'id' | 'role' | 'content' | 'citations' | 'grounded'> & { reason?: string | null };

export default function Advisor() {
  const { t, lang } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const conversationId = params.get('c');

  const [status, setStatus] = useState<RagStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [history, setHistory] = useState<AdvisorConversation[]>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    invokeFunction<RagStatus>('rag-status', undefined, 'GET')
      .then(setStatus)
      .catch(() => setStatusError(true));
  }, [user]);

  const loadHistory = useCallback(async () => {
    const sb = await getSupabase();
    if (!sb || !user) return setHistory([]);
    const { data } = await sb.from('advisor_conversations').select('id,title,created_at,updated_at').order('updated_at', { ascending: false }).limit(30);
    setHistory(data ?? []);
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let active = true;
    (async () => {
      const sb = await getSupabase();
      if (!sb || !user || !conversationId) {
        if (!conversationId) setMessages([]);
        return;
      }
      const { data } = await sb
        .from('advisor_messages')
        .select('id,role,content,citations,grounded,refusal_reason,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at');
      if (active) setMessages(((data ?? []) as (UiMessage & { refusal_reason: string | null })[]).map((m) => ({ ...m, reason: m.refusal_reason })));
    })();
    return () => {
      active = false;
    };
  }, [conversationId, user]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const ready = isSupabaseConfigured && !!user && !!status && status.embedding_configured && status.llm_configured;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || sending || !ready) return;
    if (q.length > MAX_LEN) {
      setError(t.advisor.tooLong(MAX_LEN));
      return;
    }
    setError(null);
    setInput('');
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', content: q, citations: [], grounded: null }]);
    setSending(true);
    try {
      const reply = await invokeFunction<AdvisorReply>('advisor-chat', { question: q, conversation_id: conversationId, language: lang });
      setMessages((m) => [...m, { ...reply.message, role: 'assistant' }]);
      if (reply.conversation_id !== conversationId) {
        setParams({ c: reply.conversation_id }, { replace: true });
      }
      loadHistory();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : '';
      setError(
        code === 'rate_limited'
          ? t.advisor.rateLimited
          : code === 'llm_not_configured' || code === 'embedding_not_configured'
            ? t.advisor.notConfigured
            : code === 'functions_unreachable'
              ? t.admin.ragPage.functionsUnreachable
              : t.common.errorGeneric,
      );
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setInput(q);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const newChat = () => {
    setParams({}, { replace: false });
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    if (!window.confirm(t.common.confirmDelete)) return;
    const sb = await getSupabase();
    await sb?.from('advisor_conversations').delete().eq('id', id);
    if (id === conversationId) newChat();
    loadHistory();
  };

  let gate: ReactNode = null;
  if (!isSupabaseConfigured) {
    gate = <Notice tone="warning" title={t.advisor.notConfiguredTitle}>{t.advisor.notConfigured}</Notice>;
  } else if (!authLoading && !user) {
    gate = (
      <Notice tone="info">
        {t.advisor.loginToUse}{' '}
        <Link to="/login" state={{ from: '/advisor' }} className="font-bold underline">
          {t.nav.login}
        </Link>
      </Notice>
    );
  } else if (statusError) {
    gate = <Notice tone="error" title={t.advisor.notConfiguredTitle}>{t.admin.ragPage.functionsUnreachable}</Notice>;
  } else if (status && (!status.embedding_configured || !status.llm_configured)) {
    gate = (
      <Notice tone="warning" title={t.advisor.notConfiguredTitle}>
        {t.advisor.notConfigured}
        {status.missing.length > 0 && (
          <span className="mt-1 block" dir="ltr">
            {t.advisor.missingConfig} <code className="font-mono text-xs">{status.missing.join(', ')}</code>
          </span>
        )}
      </Notice>
    );
  } else if (status && status.indexed_chunks === 0) {
    gate = <Notice tone="info">{t.advisor.noDocuments}</Notice>;
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-navy">{t.advisor.title}</h1>
        <p className="mt-2 text-muted">{t.advisor.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
        <aside className="card hidden h-[calc(100svh-14rem)] min-h-[28rem] flex-col p-3 lg:flex" aria-label={t.advisor.history}>
          <button type="button" className="btn-primary w-full" onClick={newChat}>
            <MessageSquarePlus className="size-4" aria-hidden />
            {t.advisor.newChat}
          </button>
          <p className="mt-4 mb-2 px-2 text-xs font-bold tracking-wide text-muted uppercase">{t.advisor.history}</p>
          <ul className="flex-1 space-y-0.5 overflow-y-auto">
            {history.length === 0 && <li className="px-2 py-2 text-sm text-muted">{t.advisor.noHistory}</li>}
            {history.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button
                  type="button"
                  onClick={() => setParams({ c: c.id })}
                  className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-start text-sm ${c.id === conversationId ? 'bg-academic/10 font-bold text-academic' : 'text-navy hover:bg-mist'}`}
                >
                  <span className="block truncate" dir="auto">{c.title || t.advisor.newChat}</span>
                  <span className="block text-[11px] font-normal text-muted">{formatDateTime(c.updated_at, lang)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteConversation(c.id)}
                  aria-label={t.advisor.deleteConversation}
                  className="rounded-lg p-1.5 text-muted opacity-0 group-hover:opacity-100 hover:text-red-700 focus:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="card flex h-[calc(100svh-14rem)] min-h-[30rem] flex-col overflow-hidden" aria-label={t.advisor.title}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3 lg:hidden">
            <span className="text-sm font-bold text-navy">{t.advisor.title}</span>
            <button type="button" className="btn-ghost px-3 py-1.5" onClick={newChat}>
              <MessageSquarePlus className="size-4" aria-hidden />
              {t.advisor.newChat}
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-5 overflow-y-auto bg-mist/40 p-4 sm:p-6" aria-live="polite">
            {gate}
            {messages.length === 0 && !sending ? (
              <div className="flex flex-col items-center pt-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-navy text-gold-light">
                  <Bot className="size-7" aria-hidden />
                </span>
                <h2 className="mt-4 text-xl font-bold text-navy">{t.advisor.emptyTitle}</h2>
                <p className="mt-6 mb-3 text-sm font-bold text-muted">{t.advisor.suggested}</p>
                <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                  {t.advisor.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!ready}
                      onClick={() => {
                        if (s.includes('…')) {
                          setInput(s.replace('…', ''));
                          inputRef.current?.focus();
                        } else send(s);
                      }}
                      dir="auto"
                      className="rounded-xl border border-line bg-white px-4 py-3 text-start text-sm text-navy transition hover:border-gold hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {sending && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <Spinner className="size-4" />
                {t.advisor.thinking}
              </div>
            )}
            {error && (
              <Notice tone="error" title={t.advisor.errorTitle}>
                {error}
              </Notice>
            )}
          </div>

          <form onSubmit={onSubmit} className="border-t border-line bg-white p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <label htmlFor="advisor-input" className="sr-only">{t.advisor.placeholder}</label>
              <textarea
                id="advisor-input"
                ref={inputRef}
                rows={1}
                dir="auto"
                maxLength={MAX_LEN + 200}
                value={input}
                disabled={!ready}
                placeholder={t.advisor.placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                className="input max-h-40 min-h-12 flex-1 resize-none py-3"
              />
              <button type="submit" className="btn-primary h-12 px-4" disabled={!ready || sending || !input.trim()} aria-label={t.advisor.send}>
                <Send className="size-4 rtl:-scale-x-100" aria-hidden />
                <span className="hidden sm:inline">{t.advisor.send}</span>
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">{t.advisor.disclaimer}</p>
          </form>
        </section>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UiMessage }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  if (message.role === 'user') {
    return (
      <div className="flex justify-end gap-2.5">
        <p className="max-w-[85%] rounded-2xl rounded-se-sm bg-academic px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white shadow-sm" dir="auto">
          {message.content}
        </p>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy text-white" aria-label={t.advisor.you}>
          <User className="size-4" aria-hidden />
        </span>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/20 text-gold-dark" aria-label={t.advisor.assistant}>
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="max-w-[90%] min-w-0 flex-1 rounded-2xl rounded-ss-sm border border-line bg-white px-4 py-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {message.grounded ? (
            <Badge tone="green">
              <ShieldCheck className="size-3.5" aria-hidden />
              {t.advisor.groundedBadge}
            </Badge>
          ) : message.reason === 'smalltalk' ? (
            <span />
          ) : (
            <Badge tone="gold">
              <ShieldAlert className="size-3.5" aria-hidden />
              {t.advisor.refusedBadge}
            </Badge>
          )}
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-mist hover:text-navy">
            {copied ? <Check className="size-3.5 text-emerald-600" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? t.advisor.copied : t.advisor.copy}
          </button>
        </div>
        <div className="space-y-2 text-sm leading-relaxed text-ink" dir="auto">
          <AnswerText text={message.content} citations={message.citations} msgId={message.id} />
        </div>
        {message.citations.length > 0 && <Sources citations={message.citations} msgId={message.id} />}
      </div>
    </div>
  );
}

function inline(text: string, citations: Citation[], msgId: string): ReactNode[] {
  const valid = new Set(citations.map((c) => c.index));
  return text.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const m = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
    if (m) {
      const nums = m[1].split(',').map((n) => Number(n.trim())).filter((n) => valid.has(n));
      if (!nums.length) return null;
      return (
        <sup key={i} className="mx-0.5">
          {nums.map((n) => (
            <a key={n} href={`#cite-${msgId}-${n}`} className="ms-0.5 rounded bg-gold/20 px-1 text-[10px] font-bold text-gold-dark no-underline hover:bg-gold/40">
              {n}
            </a>
          ))}
        </sup>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function AnswerText({ text, citations, msgId }: { text: string; citations: Citation[]; msgId: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="list-disc space-y-1 ps-5">
          {list.map((li, i) => (
            <li key={i}>{inline(li, citations, msgId)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const item = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (item) list.push(item[1]);
    else {
      flush();
      if (line) blocks.push(<p key={`p${blocks.length}`}>{inline(line, citations, msgId)}</p>);
    }
  }
  flush();
  return <>{blocks}</>;
}

function Sources({ citations, msgId }: { citations: Citation[]; msgId: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 text-xs font-bold text-muted">{t.advisor.sources}</p>
      <ol className="space-y-2">
        {citations.map((c) => (
          <li key={c.index} id={`cite-${msgId}-${c.index}`} className="rounded-xl bg-mist/70 p-2.5 text-xs">
            <details>
              <summary className="flex cursor-pointer list-none items-start gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded bg-gold/25 font-bold text-gold-dark">{c.index}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold text-navy" dir="auto">
                    <FileText className="size-3.5 shrink-0" aria-hidden />
                    {c.kind === 'course' ? `${t.advisor.catalogRecord} — ${c.course_number}` : c.document_title}
                    {c.version_label ? ` (${c.version_label})` : ''}
                  </span>
                  <span className="text-muted">
                    {c.page_number ? t.advisor.page(c.page_number) : ''}
                    {c.section_title ? ` · ${c.section_title}` : ''}
                  </span>
                </span>
              </summary>
              <p className="mt-2 border-s-2 border-gold/50 ps-3 leading-relaxed whitespace-pre-wrap text-muted" dir="auto">
                {c.snippet}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}