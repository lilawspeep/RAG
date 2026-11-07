import { getSupabase } from './supabase';
import type { Citation } from './types';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, status: number, details?: unknown) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Invokes a Supabase Edge Function with the current user's JWT and normalizes error payloads. */
export async function invokeFunction<T>(name: string, body?: unknown, method: 'POST' | 'GET' = 'POST'): Promise<T> {
  const sb = await getSupabase();
  if (!sb) throw new ApiError('backend_not_configured', 0);
  const { data, error } = await sb.functions.invoke(name, { body: body as Record<string, unknown>, method });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      let payload: { error?: string; details?: unknown } = {};
      try {
        payload = await ctx.clone().json();
      } catch {
        /* non-JSON body */
      }
      throw new ApiError(payload.error ?? 'function_error', ctx.status ?? 500, payload.details);
    }
    throw new ApiError('functions_unreachable', 0, String(error.message ?? error));
  }
  return data as T;
}

export interface RagStatus {
  embedding_configured: boolean;
  llm_configured: boolean;
  missing: string[];
  embedding_model?: string;
  llm_model?: string;
  embedding_dimensions?: number;
  indexed_documents?: number;
  indexed_chunks?: number;
}

export interface AdvisorReply {
  conversation_id: string;
  message: {
    id: string;
    content: string;
    citations: Citation[];
    grounded: boolean;
    reason?: 'no_evidence' | 'insufficient_evidence' | 'no_documents' | 'smalltalk' | null;
    created_at: string;
  };
}

export interface RetrievalHit {
  chunk_id: string;
  document_title: string;
  version_label: string | null;
  page_number: number | null;
  section_title: string | null;
  content: string;
  similarity: number | null;
  keyword_rank: number | null;
  score: number;
}
