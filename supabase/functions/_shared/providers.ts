// OpenAI-compatible providers (OpenAI, Azure OpenAI via compatible gateway, Together, Groq, OpenRouter,
// local vLLM, …). Keys live only in Edge Function secrets.

export interface ProviderConfig {
  embedding: { key: string; base: string; model: string; dimensions: number } | null;
  llm: { key: string; base: string; model: string } | null;
  matchCount: number;
  minSimilarity: number;
  missing: string[];
}

export const EMBEDDING_DIMENSIONS = 1536;

export function providerConfig(): ProviderConfig {
  const env = (k: string) => Deno.env.get(k)?.trim() || '';
  const missing: string[] = [];
  const eKey = env('EMBEDDING_API_KEY');
  const lKey = env('LLM_API_KEY');
  if (!eKey) missing.push('EMBEDDING_API_KEY');
  if (!lKey) missing.push('LLM_API_KEY');
  return {
    embedding: eKey
      ? {
          key: eKey,
          base: (env('EMBEDDING_API_BASE') || 'https://api.openai.com/v1').replace(/\/$/, ''),
          model: env('EMBEDDING_MODEL') || 'text-embedding-3-small',
          dimensions: EMBEDDING_DIMENSIONS,
        }
      : null,
    llm: lKey
      ? {
          key: lKey,
          base: (env('LLM_API_BASE') || 'https://api.openai.com/v1').replace(/\/$/, ''),
          model: env('LLM_MODEL') || 'gpt-4o-mini',
        }
      : null,
    matchCount: Math.min(Math.max(Number(env('RAG_MATCH_COUNT')) || 8, 3), 20),
    minSimilarity: Number.isFinite(Number(env('RAG_MIN_SIMILARITY'))) && env('RAG_MIN_SIMILARITY') ? Number(env('RAG_MIN_SIMILARITY')) : 0.3,
    missing,
  };
}

export class ProviderError extends Error {
  constructor(
    public code: 'rate_limited' | 'provider_error' | 'dimension_mismatch',
    message: string,
  ) {
    super(message);
  }
}

async function post(url: string, key: string, body: unknown): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = (await res.text()).slice(0, 300);
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      continue;
    }
    throw new ProviderError(res.status === 429 ? 'rate_limited' : 'provider_error', `${res.status} ${text}`);
  }
}

export async function embed(cfg: NonNullable<ProviderConfig['embedding']>, inputs: string[]): Promise<number[][]> {
  const body: Record<string, unknown> = { model: cfg.model, input: inputs.map((s) => s.slice(0, 8000)) };
  if (cfg.model.startsWith('text-embedding-3')) body.dimensions = cfg.dimensions;
  const data = (await post(`${cfg.base}/embeddings`, cfg.key, body)) as { data: { index: number; embedding: number[] }[] };
  const vectors = [...data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vectors.some((v) => v.length !== cfg.dimensions)) {
    throw new ProviderError('dimension_mismatch', `Embedding model must return ${cfg.dimensions} dimensions (see README).`);
  }
  return vectors;
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chat(
  cfg: NonNullable<ProviderConfig['llm']>,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<string> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 900,
  };
  if (opts.json) body.response_format = { type: 'json_object' };
  const data = (await post(`${cfg.base}/chat/completions`, cfg.key, body)) as { choices: { message: { content: string | null } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
