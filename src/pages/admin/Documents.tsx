import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { ApiError, invokeFunction } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/format';
import { DOCUMENT_TYPES, type DocumentRow, type DocumentStatus } from '../../lib/types';
import { Badge, Field, Notice, Spinner, errorProps } from '../../components/ui';
import { dbErrorMessage, useRows } from './EntityManager';

const MAX_BYTES = 20 * 1024 * 1024;
const statusTone: Record<DocumentStatus, 'neutral' | 'blue' | 'green' | 'red'> = { pending: 'neutral', processing: 'blue', indexed: 'green', failed: 'red' };

export default function Documents() {
  const { t, lang } = useI18n();
  const d = t.admin.docs;
  const { rows, error, reload } = useRows<DocumentRow>('documents', '*', { column: 'created_at', ascending: false });
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Poll while any document is being indexed so status changes appear without a manual refresh.
  useEffect(() => {
    if (!rows?.some((r) => r.status === 'processing' || r.status === 'pending')) return;
    const id = setInterval(reload, 4000);
    return () => clearInterval(id);
  }, [rows, reload]);

  const ingest = async (doc: Pick<DocumentRow, 'id'>) => {
    setBusyId(doc.id);
    try {
      const res = await invokeFunction<{ chunks: number; pages: number }>('ingest-document', { document_id: doc.id });
      setNotice({ tone: 'success', text: d.indexedOk(res.chunks, res.pages) });
    } catch (e) {
      const code = e instanceof ApiError ? `${e.code}${e.details ? `: ${String(e.details)}` : ''}` : String(e);
      setNotice({ tone: 'error', text: `${t.common.errorGeneric} (${code})` });
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const setCurrent = async (doc: DocumentRow) => {
    const sb = await getSupabase();
    if (!sb) return;
    const { error: e } = await sb.rpc('set_current_document_version', { p_document_id: doc.id });
    if (e) setNotice({ tone: 'error', text: dbErrorMessage(e, t.common.errorGeneric) });
    reload();
  };

  const view = async (doc: DocumentRow) => {
    const sb = await getSupabase();
    const { data } = (await sb?.storage.from('documents').createSignedUrl(doc.storage_path, 300)) ?? {};
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  const remove = async (doc: DocumentRow) => {
    if (!window.confirm(t.common.confirmDelete)) return;
    const sb = await getSupabase();
    if (!sb) return;
    await sb.storage.from('documents').remove([doc.storage_path]);
    const { error: e } = await sb.from('documents').delete().eq('id', doc.id);
    if (e) setNotice({ tone: 'error', text: dbErrorMessage(e, t.common.errorGeneric) });
    reload();
  };

  return (
    <>
      <UploadForm documents={rows ?? []} onUploaded={(doc) => { setNotice({ tone: 'success', text: d.uploaded }); reload(); ingest(doc); }} />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-navy">{t.admin.documents}</h2>
          <button type="button" className="btn-ghost py-2" onClick={reload}>
            <RefreshCw className="size-4" aria-hidden />
            {t.common.refresh}
          </button>
        </div>
        {rows === null ? (
          <div className="p-6"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">{d.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-navy">
                    <span dir="auto">{doc.title}</span>
                    {doc.version_label && <Badge>{doc.version_label}</Badge>}
                    {doc.is_current ? <Badge tone="gold">{d.current}</Badge> : <Badge>{d.archived}</Badge>}
                    <Badge tone={statusTone[doc.status]}>{d.statuses[doc.status]}</Badge>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {d.types[doc.doc_type]} · {d.langs[doc.language]} · {d.pages}: {doc.page_count ?? '—'} · {d.chunks}: {doc.chunk_count ?? '—'} ·{' '}
                    {formatBytes(doc.file_size) ?? ''} · {formatDateTime(doc.indexed_at ?? doc.created_at, lang)}
                  </p>
                  {doc.status === 'failed' && doc.error_message && <p className="mt-1 text-xs text-red-700" dir="ltr">{doc.error_message}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => view(doc)}>
                    <ExternalLink className="size-4" aria-hidden />
                    {d.view}
                  </button>
                  <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => ingest(doc)} disabled={busyId === doc.id || doc.status === 'processing'}>
                    {busyId === doc.id ? <Spinner className="size-4" /> : <RefreshCw className="size-4" aria-hidden />}
                    {busyId === doc.id ? d.indexing : d.reindex}
                  </button>
                  {!doc.is_current && (
                    <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setCurrent(doc)}>
                      <Star className="size-4" aria-hidden />
                      {d.setCurrent}
                    </button>
                  )}
                  <button type="button" className="btn-ghost p-2 text-red-700 hover:bg-red-50" aria-label={t.common.delete} onClick={() => remove(doc)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function UploadForm({ documents, onUploaded }: { documents: DocumentRow[]; onUploaded: (doc: DocumentRow) => void }) {
  const { t } = useI18n();
  const d = t.admin.docs;
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState({ title: '', doc_type: 'regulation', language: 'ar', version_label: '', effective_date: '', supersedes: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ title?: string; file?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = documents.filter((x) => x.is_current);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      title: v.title.trim().length < 3 ? t.validation.minLength(3) : undefined,
      file: !file || file.type !== 'application/pdf' || file.size > MAX_BYTES ? d.invalidFile : undefined,
    };
    setErrors(errs);
    if (errs.title || errs.file || !file) return;
    setBusy(true);
    setFormError(null);
    const sb = await getSupabase();
    if (!sb) return;
    const id = crypto.randomUUID();
    const previous = documents.find((x) => x.id === v.supersedes);
    const versionGroup = previous?.version_group ?? id;
    const path = `${versionGroup}/${id}.pdf`;
    const up = await sb.storage.from('documents').upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (up.error) {
      setBusy(false);
      setFormError(dbErrorMessage({ message: up.error.message }, t.common.errorGeneric));
      return;
    }
    const { data, error } = await sb
      .from('documents')
      .insert({
        id,
        title: v.title.trim(),
        doc_type: v.doc_type,
        language: v.language,
        version_label: v.version_label.trim() || null,
        effective_date: v.effective_date || null,
        version_group: versionGroup,
        storage_path: path,
        file_size: file.size,
        mime_type: file.type,
        is_current: !previous,
      })
      .select('*')
      .single();
    setBusy(false);
    if (error) {
      await sb.storage.from('documents').remove([path]);
      setFormError(dbErrorMessage(error, t.common.errorGeneric));
      return;
    }
    setV({ ...v, title: '', version_label: '', effective_date: '', supersedes: '' });
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    onUploaded(data as DocumentRow);
  };

  return (
    <form noValidate onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
        <Upload className="size-5 text-gold-dark" aria-hidden />
        {d.upload}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label={d.title} htmlFor="u-title" error={errors.title}>
            <input {...errorProps('u-title', errors.title)} className="input" dir="auto" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
        </div>
        <Field label={d.type} htmlFor="u-type">
          <select id="u-type" className="input" value={v.doc_type} onChange={(e) => setV({ ...v, doc_type: e.target.value })}>
            {DOCUMENT_TYPES.map((k) => <option key={k} value={k}>{d.types[k]}</option>)}
          </select>
        </Field>
        <Field label={d.language} htmlFor="u-lang">
          <select id="u-lang" className="input" value={v.language} onChange={(e) => setV({ ...v, language: e.target.value })}>
            {(['ar', 'en', 'mixed'] as const).map((k) => <option key={k} value={k}>{d.langs[k]}</option>)}
          </select>
        </Field>
        <Field label={d.version} htmlFor="u-ver" optional>
          <input id="u-ver" className="input" value={v.version_label} onChange={(e) => setV({ ...v, version_label: e.target.value })} />
        </Field>
        <Field label={d.effectiveDate} htmlFor="u-date" optional>
          <input id="u-date" type="date" className="input" value={v.effective_date} onChange={(e) => setV({ ...v, effective_date: e.target.value })} />
        </Field>
        <Field label={d.supersedes} htmlFor="u-sup" optional>
          <select id="u-sup" className="input" value={v.supersedes} onChange={(e) => setV({ ...v, supersedes: e.target.value })}>
            <option value="">{d.supersedesNone}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.title}{g.version_label ? ` (${g.version_label})` : ''}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={d.file} htmlFor="u-file" error={errors.file} hint={d.fileHint}>
            <input
              {...errorProps('u-file', errors.file)}
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="input file:me-3 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-1.5 file:font-semibold file:text-navy"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </div>
      </div>
      {formError && <Notice tone="error">{formError}</Notice>}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy || !isSupabaseConfigured}>
          {busy ? <Spinner className="size-4 text-white" /> : <Upload className="size-4" aria-hidden />}
          {busy ? d.uploading : d.submit}
        </button>
      </div>
    </form>
  );
}
