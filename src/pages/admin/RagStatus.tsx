import { useEffect, useState, type FormEvent } from 'react';
import { CircleCheck, CircleX, Search } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { isSupabaseConfigured } from '../../lib/supabase';
import { ApiError, invokeFunction, type RagStatus as RagStatusT, type RetrievalHit } from '../../lib/api';
import { Badge, Notice, Spinner } from '../../components/ui';

export default function RagStatus() {
  const { t } = useI18n();
  const r = t.admin.ragPage;
  const [status, setStatus] = useState<RagStatusT | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RetrievalHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    invokeFunction<RagStatusT>('rag-status', undefined, 'GET')
      .then(setStatus)
      .catch((e) => setStatusError(e instanceof ApiError && e.code === 'functions_unreachable' ? r.functionsUnreachable : t.common.errorGeneric));
  }, [r.functionsUnreachable, t.common.errorGeneric]);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setTestError(null);
    try {
      const res = await invokeFunction<{ hits: RetrievalHit[] }>('rag-status', { query: query.trim() });
      setHits(res.hits);
    } catch (err) {
      setTestError(err instanceof ApiError ? `${t.common.errorGeneric} (${err.code})` : t.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const Row = ({ label, ok, model }: { label: string; ok?: boolean; model?: string }) => (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="font-semibold text-navy">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        {model && <code className="rounded bg-mist px-2 py-0.5 text-xs" dir="ltr">{model}</code>}
        {ok === undefined ? (
          <span className="text-muted">—</span>
        ) : ok ? (
          <Badge tone="green"><CircleCheck className="size-3.5" aria-hidden /> {r.configured}</Badge>
        ) : (
          <Badge tone="red"><CircleX className="size-3.5" aria-hidden /> {r.notConfigured}</Badge>
        )}
      </span>
    </li>
  );

  return (
    <>
      {!isSupabaseConfigured && <Notice tone="warning">{t.config.backendMissing}</Notice>}
      {statusError && <Notice tone="error">{statusError}</Notice>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 text-lg font-bold text-navy">{r.config}</h2>
          <ul className="divide-y divide-line">
            <Row label="Supabase" ok={isSupabaseConfigured} />
            <Row label={r.embedding} ok={status?.embedding_configured} model={status?.embedding_model} />
            <Row label={r.llm} ok={status?.llm_configured} model={status?.llm_model} />
            <li className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-semibold text-navy">{t.admin.stats.indexed}</span>
              <span>{status?.indexed_documents ?? '—'} / {t.admin.stats.chunks}: {status?.indexed_chunks ?? '—'}</span>
            </li>
          </ul>
          {status && status.missing.length > 0 && (
            <div className="border-t border-line px-5 py-3 text-xs text-muted">
              {r.missingSecrets}: <code dir="ltr">{status.missing.join(', ')}</code>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-lg font-bold text-navy">{r.pipeline}</h2>
          <ol className="mt-4 space-y-2.5">
            {r.pipelineSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-gold-light">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-bold text-navy">{r.testRetrieval}</h2>
        <p className="mt-1 text-sm text-muted">{r.testHint}</p>
        <form onSubmit={run} className="mt-4 flex gap-2">
          <input className="input flex-1" dir="auto" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={r.testRetrieval} maxLength={500} />
          <button type="submit" className="btn-primary" disabled={busy || !status?.embedding_configured}>
            {busy ? <Spinner className="size-4 text-white" /> : <Search className="size-4" aria-hidden />}
            {r.run}
          </button>
        </form>
        {testError && <Notice tone="error" className="mt-3">{testError}</Notice>}
        {hits && (
          hits.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{r.noMatches}</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {hits.map((h, i) => (
                <li key={h.chunk_id} className="rounded-xl border border-line p-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-navy">
                    <span>[{i + 1}]</span>
                    <span dir="auto">{h.document_title}</span>
                    {h.version_label && <Badge>{h.version_label}</Badge>}
                    {h.page_number != null && <Badge tone="blue">{t.advisor.page(h.page_number)}</Badge>}
                    <span className="ms-auto text-xs font-normal text-muted" dir="ltr">
                      {r.score} {h.score.toFixed(4)} · {r.similarity} {h.similarity?.toFixed(3) ?? '—'} · {r.keyword} {h.keyword_rank?.toFixed(3) ?? '—'}
                    </span>
                  </p>
                  {h.section_title && <p className="mt-1 text-xs text-gold-dark" dir="auto">{h.section_title}</p>}
                  <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-ink" dir="auto">{h.content}</p>
                </li>
              ))}
            </ol>
          )
        )}
      </section>
    </>
  );
}
