import { extractText, getDocumentProxy } from 'npm:unpdf@1';
import { fail, json, preflight } from '../_shared/cors.ts';
import { getUser, isAdmin, serviceClient } from '../_shared/auth.ts';
import { ProviderError, embed, providerConfig } from '../_shared/providers.ts';
import { chunkPages, embeddingInput, normalizeForSearch } from '../_shared/rag.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMBED_BATCH = 64;
const INSERT_BATCH = 100;

class IngestError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 405, 'method_not_allowed');

  const user = await getUser(req);
  if (!user) return fail(req, 401, 'unauthorized');
  if (!(await isAdmin(user.id))) return fail(req, 403, 'forbidden');

  const body = await req.json().catch(() => ({}));
  const documentId = typeof body.document_id === 'string' ? body.document_id : '';
  if (!UUID_RE.test(documentId)) return fail(req, 400, 'invalid_document_id');

  const cfg = providerConfig();
  if (!cfg.embedding) return fail(req, 503, 'embedding_not_configured', cfg.missing);

  const sb = serviceClient();
  const { data: doc, error: docErr } = await sb.from('documents').select('*').eq('id', documentId).maybeSingle();
  if (docErr || !doc) return fail(req, 404, 'document_not_found');

  const { data: claimed } = await sb
    .from('documents')
    .update({ status: 'processing', error_message: null })
    .eq('id', documentId)
    .neq('status', 'processing')
    .select('id')
    .maybeSingle();
  if (!claimed) return fail(req, 409, 'already_processing');

  try {
    const file = await sb.storage.from('documents').download(doc.storage_path);
    if (file.error || !file.data) throw new IngestError('file_missing', 'The PDF file was not found in storage.');

    const pdf = await getDocumentProxy(new Uint8Array(await file.data.arrayBuffer()));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [text];
    const textChars = pages.join('').replace(/\s/g, '').length;
    if (textChars < 40 * Math.max(1, Math.min(totalPages, 5))) {
      throw new IngestError('no_text_layer', 'No extractable text found. The PDF appears to be scanned; run OCR on it and upload again.');
    }

    const chunks = chunkPages(pages);
    if (chunks.length === 0) throw new IngestError('no_chunks', 'No usable text chunks were produced from this PDF.');

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      vectors.push(...(await embed(cfg.embedding, batch.map((c) => embeddingInput(doc.title, c)))));
    }

    const del = await sb.from('document_chunks').delete().eq('document_id', documentId);
    if (del.error) throw new IngestError('db_error', del.error.message);

    const rows = chunks.map((c, i) => ({
      document_id: documentId,
      page_number: c.page_number,
      chunk_index: c.chunk_index,
      section_title: c.section_title,
      content: c.content,
      search_text: normalizeForSearch(`${doc.title} ${c.section_title ?? ''} ${c.content}`),
      embedding: JSON.stringify(vectors[i]),
      token_estimate: Math.ceil(c.content.length / 4),
    }));
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const ins = await sb.from('document_chunks').insert(rows.slice(i, i + INSERT_BATCH));
      if (ins.error) throw new IngestError('db_error', ins.error.message);
    }

    const firstIndexing = !doc.indexed_at;
    await sb
      .from('documents')
      .update({ status: 'indexed', page_count: totalPages, chunk_count: chunks.length, indexed_at: new Date().toISOString(), embedding_model: cfg.embedding.model })
      .eq('id', documentId);

    // A newly uploaded version becomes current once it is indexed successfully; re-indexing an
    // older version never changes which version is current.
    if (firstIndexing) {
      const { data: newest } = await sb
        .from('documents')
        .select('id')
        .eq('version_group', doc.version_group)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (newest?.id === documentId) await sb.rpc('set_current_document_version', { p_document_id: documentId });
    }

    return json(req, { document_id: documentId, pages: totalPages, chunks: chunks.length });
  } catch (e) {
    const code = e instanceof IngestError || e instanceof ProviderError ? e.code : 'ingest_failed';
    const message = e instanceof Error ? e.message : String(e);
    await sb.from('documents').update({ status: 'failed', error_message: `${code}: ${message}`.slice(0, 500) }).eq('id', documentId);
    return fail(req, code === 'rate_limited' ? 429 : 422, code, message.slice(0, 300));
  }
});
