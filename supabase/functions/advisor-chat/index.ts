import { fail, json, preflight } from '../_shared/cors.ts';
import { getUser, serviceClient } from '../_shared/auth.ts';
import { ProviderError, chat, embed, providerConfig } from '../_shared/providers.ts';
import {
  REFUSALS,
  buildAnswerMessages,
  buildRewriteMessages,
  cleanCitationMarkers,
  detectLanguage,
  expandDialect,
  findCourseNumbers,
  isInsufficient,
  normalizeForSearch,
  parseCitations,
  parseRewrite,
  snippet,
  type EvidenceItem,
  type HistoryTurn,
  type RefusalReason,
  type Rewrite,
} from '../_shared/rag.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QUESTION = 1000;
const RATE_WINDOW_MIN = 10;
const RATE_MAX = 30;

interface Hit {
  chunk_id: string;
  document_id: string;
  document_title: string;
  version_label: string | null;
  page_number: number;
  section_title: string | null;
  content: string;
  similarity: number | null;
  keyword_rank: number | null;
  score: number;
}

interface CourseRow {
  course_number: string;
  name_ar: string;
  name_en: string | null;
  credit_hours: number | null;
  description_ar: string | null;
  description_en: string | null;
  last_verified_at: string | null;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail(req, 405, 'method_not_allowed');

  const user = await getUser(req);
  if (!user) return fail(req, 401, 'unauthorized');

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return fail(req, 400, 'empty_question');
  if (question.length > MAX_QUESTION) return fail(req, 400, 'question_too_long');
  const lang: 'ar' | 'en' = body.language === 'en' || body.language === 'ar' ? body.language : detectLanguage(question);

  const cfg = providerConfig();
  if (!cfg.embedding) return fail(req, 503, 'embedding_not_configured', cfg.missing);
  if (!cfg.llm) return fail(req, 503, 'llm_not_configured', cfg.missing);

  const sb = serviceClient();

  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const { count: recent } = await sb
    .from('advisor_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', since);
  if ((recent ?? 0) >= RATE_MAX) return fail(req, 429, 'rate_limited');

  // Conversation ownership is checked explicitly because the service role bypasses RLS.
  let conversationId: string | null = typeof body.conversation_id === 'string' && UUID_RE.test(body.conversation_id) ? body.conversation_id : null;
  let history: HistoryTurn[] = [];
  if (conversationId) {
    const { data: conv } = await sb.from('advisor_conversations').select('id').eq('id', conversationId).eq('user_id', user.id).maybeSingle();
    if (!conv) conversationId = null;
    else {
      const { data: prev } = await sb
        .from('advisor_messages')
        .select('role,content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(6);
      history = ((prev ?? []) as HistoryTurn[]).reverse();
    }
  }
  if (!conversationId) {
    const { data: conv, error } = await sb
      .from('advisor_conversations')
      .insert({ user_id: user.id, title: question.slice(0, 80) })
      .select('id')
      .single();
    if (error || !conv) return fail(req, 500, 'db_error');
    conversationId = conv.id as string;
  }

  await sb.from('advisor_messages').insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content: question });

  const reply = async (content: string, grounded: boolean, citations: unknown[], reason: RefusalReason | null) => {
    const { data: msg, error } = await sb
      .from('advisor_messages')
      .insert({ conversation_id: conversationId, user_id: user.id, role: 'assistant', content, citations, grounded, refusal_reason: reason })
      .select('id,content,citations,grounded,created_at')
      .single();
    await sb.from('advisor_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
    if (error || !msg) return fail(req, 500, 'db_error');
    return json(req, { conversation_id: conversationId, message: { ...msg, reason } });
  };
  const refuse = (reason: RefusalReason) => reply(REFUSALS[reason][lang], false, [], reason);

  try {
    const { count: docCount } = await sb
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'indexed')
      .eq('is_current', true);

    let rewrite: Rewrite;
    try {
      rewrite = parseRewrite(await chat(cfg.llm, buildRewriteMessages(question, history), { temperature: 0, maxTokens: 300, json: true }), question);
    } catch (e) {
      if (e instanceof ProviderError && e.code === 'rate_limited') throw e;
      const lastUser = [...history].reverse().find((h) => h.role === 'user')?.content ?? '';
      rewrite = parseRewrite('', `${lastUser} ${question}`.trim());
    }
    if (rewrite.intent === 'smalltalk' && findCourseNumbers(question).length === 0) return await refuse('smalltalk');

    const evidence: (EvidenceItem & { citation: Record<string, unknown> })[] = [];

    // Course catalog records (canonical by course number) are verified structured evidence.
    const candidates = findCourseNumbers(`${question} ${rewrite.standalone_question}`);
    if (candidates.length) {
      const { data: courses } = await sb
        .from('courses')
        .select('course_number,name_ar,name_en,credit_hours,description_ar,description_en,last_verified_at')
        .in('course_number', candidates)
        .eq('is_active', true)
        .limit(4);
      const { data: reqs } = courses?.length
        ? await sb.from('course_prerequisites').select('course_number,required_course_number,relation_type').in('course_number', courses.map((c) => c.course_number))
        : { data: [] };
      for (const c of (courses ?? []) as CourseRow[]) {
        const pre = (reqs ?? []).filter((r) => r.course_number === c.course_number && r.relation_type === 'prerequisite').map((r) => r.required_course_number);
        const co = (reqs ?? []).filter((r) => r.course_number === c.course_number && r.relation_type === 'corequisite').map((r) => r.required_course_number);
        const content = [
          `Course number: ${c.course_number}`,
          `Name (AR): ${c.name_ar}`,
          c.name_en && `Name (EN): ${c.name_en}`,
          `Credit hours: ${c.credit_hours ?? 'not recorded'}`,
          `Prerequisites: ${pre.length ? pre.join(', ') : 'none recorded'}`,
          `Corequisites: ${co.length ? co.join(', ') : 'none recorded'}`,
          c.description_ar && `Description (AR): ${c.description_ar}`,
          c.description_en && `Description (EN): ${c.description_en}`,
          c.last_verified_at && `Last verified: ${c.last_verified_at}`,
        ]
          .filter(Boolean)
          .join('\n');
        evidence.push({
          kind: 'course',
          title: c.course_number,
          course_number: c.course_number,
          content,
          citation: { kind: 'course', course_number: c.course_number, snippet: snippet(content) },
        });
      }
    }

    if ((docCount ?? 0) === 0 && evidence.length === 0) return await refuse('no_documents');

    if ((docCount ?? 0) > 0) {
      const semantic = [rewrite.standalone_question, rewrite.search_query_ar, rewrite.search_query_en].filter(Boolean).join('\n');
      const keyword = normalizeForSearch([rewrite.search_query_ar || expandDialect(rewrite.standalone_question), rewrite.search_query_en, question].join(' '));
      const [vector] = await embed(cfg.embedding, [semantic]);
      const { data: hits, error } = await sb.rpc('hybrid_search_chunks', {
        query_embedding: JSON.stringify(vector),
        query_text: keyword,
        match_count: cfg.matchCount,
        min_similarity: cfg.minSimilarity,
      });
      if (error) throw new Error(`retrieval: ${error.message}`);
      for (const h of (hits ?? []) as Hit[]) {
        evidence.push({
          kind: 'document',
          title: h.document_title,
          version_label: h.version_label,
          page_number: h.page_number,
          section_title: h.section_title,
          document_id: h.document_id,
          content: h.content,
          citation: {
            kind: 'document',
            document_id: h.document_id,
            document_title: h.document_title,
            version_label: h.version_label,
            page_number: h.page_number,
            section_title: h.section_title,
            snippet: snippet(h.content),
          },
        });
      }
    }

    if (evidence.length === 0) return await refuse('no_evidence');

    const answer = await chat(cfg.llm, buildAnswerMessages({ question: rewrite.standalone_question || question, language: lang, evidence, history }), {
      temperature: 0.1,
      maxTokens: 900,
    });
    if (isInsufficient(answer)) return await refuse('insufficient_evidence');

    const used = parseCitations(answer, evidence.length);
    if (used.length === 0) return await refuse('insufficient_evidence');

    const citations = used.map((n) => ({ index: n, ...evidence[n - 1].citation }));
    return await reply(cleanCitationMarkers(answer, used), true, citations, null);
  } catch (e) {
    if (e instanceof ProviderError && e.code === 'rate_limited') return fail(req, 429, 'rate_limited');
    console.error('advisor-chat', e);
    return fail(req, 502, 'advisor_failed');
  }
});
