import { fail, json, preflight } from '../_shared/cors.ts';
import { getUser, isAdmin, serviceClient } from '../_shared/auth.ts';
import { EMBEDDING_DIMENSIONS, ProviderError, embed, providerConfig } from '../_shared/providers.ts';
import { expandDialect, normalizeForSearch } from '../_shared/rag.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const cfg = providerConfig();
  const sb = serviceClient();
  const user = await getUser(req);
  const admin = user ? await isAdmin(user.id) : false;

  if (req.method === 'GET') {
    const [{ count: docs }, { count: chunks }] = await Promise.all([
      sb.from('documents').select('id', { count: 'exact', head: true }).eq('status', 'indexed').eq('is_current', true),
      sb.from('document_chunks').select('id', { count: 'exact', head: true }),
    ]);
    return json(req, {
      embedding_configured: !!cfg.embedding,
      llm_configured: !!cfg.llm,
      missing: cfg.missing,
      indexed_documents: docs ?? 0,
      indexed_chunks: chunks ?? 0,
      ...(admin ? { embedding_model: cfg.embedding?.model, llm_model: cfg.llm?.model, embedding_dimensions: EMBEDDING_DIMENSIONS } : {}),
    });
  }

  if (req.method !== 'POST') return fail(req, 405, 'method_not_allowed');
  if (!user) return fail(req, 401, 'unauthorized');
  if (!admin) return fail(req, 403, 'forbidden');
  if (!cfg.embedding) return fail(req, 503, 'embedding_not_configured', cfg.missing);

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 500) : '';
  if (!query) return fail(req, 400, 'empty_query');

  try {
    const [vector] = await embed(cfg.embedding, [query]);
    const { data, error } = await sb.rpc('hybrid_search_chunks', {
      query_embedding: JSON.stringify(vector),
      query_text: normalizeForSearch(expandDialect(query)),
      match_count: cfg.matchCount,
      min_similarity: cfg.minSimilarity,
    });
    if (error) return fail(req, 500, 'retrieval_failed', error.message);
    return json(req, { hits: data ?? [] });
  } catch (e) {
    if (e instanceof ProviderError) return fail(req, e.code === 'rate_limited' ? 429 : 502, e.code);
    return fail(req, 500, 'retrieval_failed');
  }
});
