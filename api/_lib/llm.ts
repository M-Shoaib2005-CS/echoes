import { dig } from '../../shared/text';

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Per-call timeout (default 30s). The agent uses less so a whole run fits inside one function call. */
  timeoutMs?: number;
}
export interface LlmProvider {
  readonly name: string;
  complete(req: LlmRequest): Promise<string>;
}
/** Errors that will not fix themselves on a second try: quota, auth, wrong model, timeout. */
export const isFatalLlmError = (e: unknown): boolean => e instanceof LlmError && [401, 403, 404, 408, 429].includes(e.status ?? 0);

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;
const TIMEOUT_MS = 30_000;

async function postJson(f: Fetch, url: string, headers: Record<string, string>, body: unknown, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const started = Date.now();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
      console.warn(`[llm] provider answered HTTP ${res.status}: ${detail}`); // dev terminal / Vercel logs only
      throw new LlmError(`LLM HTTP ${res.status}: ${detail}`, res.status);
    }
    const json = await res.json();
    console.log(`[llm] ${new URL(url).host} answered in ${Date.now() - started}ms`); // timing for Vercel logs
    return json;
  } catch (e) {
    if (e instanceof LlmError) throw e;
    if ((e as { name?: string }).name === 'AbortError') {
      console.warn(`[llm] no answer within ${timeoutMs / 1000}s, giving up`);
      throw new LlmError('LLM request timed out', 408);
    }
    const cause = (e as { cause?: unknown }).cause;
    const reason = `${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}${cause ? ` (cause: ${String(cause)})` : ''}`;
    console.warn(`[llm] request failed before an answer: ${reason}`); // dev terminal / Vercel logs only
    throw new LlmError(`LLM request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

function gemini(apiKey: string, model: string, f: Fetch): LlmProvider {
  return {
    name: 'gemini',
    async complete({ system, user, maxTokens = 4096, timeoutMs }) {
      const data = await postJson(
        f,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: maxTokens,
            // 2.5 models spend output tokens on hidden "thinking", which can truncate the JSON. Not needed here.
            ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        },
        timeoutMs,
      );
      const parts = dig(data, 'candidates', 0, 'content', 'parts');
      const text = Array.isArray(parts)
        ? parts.map((p) => dig(p, 'text')).filter((t): t is string => typeof t === 'string').join('')
        : '';
      if (!text) throw new LlmError('Empty LLM response');
      return text;
    },
  };
}

function openAiCompatible(name: string, url: string, apiKey: string, model: string, f: Fetch, extra: Record<string, unknown> = {}): LlmProvider {
  return {
    name,
    async complete({ system, user, maxTokens = 2048, timeoutMs }) {
      const body = (jsonMode: boolean) => ({
        model,
        temperature: 0.7,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...extra,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const headers = { Authorization: `Bearer ${apiKey}` };
      let data: unknown;
      try {
        data = await postJson(f, url, headers, body(true), timeoutMs);
      } catch (e) {
        // Reasoning models sometimes return nothing in forced-JSON mode ("json_validate_failed").
        // Retry once without it; parseLlmJson extracts the JSON from plain text anyway.
        if (!(e instanceof LlmError && e.status === 400 && e.message.includes('json_validate_failed'))) throw e;
        console.warn(`[llm] ${name} rejected forced JSON mode, retrying without it`);
        data = await postJson(f, url, headers, body(false), timeoutMs);
      }
      const text = dig(data, 'choices', 0, 'message', 'content');
      if (typeof text !== 'string' || !text) throw new LlmError('Empty LLM response');
      return text;
    },
  };
}

/** One interface, three free-tier providers, chosen by env. Returns null when no key is set. */
export function createLlm(env: Record<string, string | undefined>, f: Fetch = fetch): LlmProvider | null {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) return null;
  const provider = (env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  const model = env.LLM_MODEL || undefined;
  switch (provider) {
    case 'groq': {
      // llama-3.3-70b-versatile became Enterprise-only; the gpt-oss models are the public production ones.
      const groqModel = model ?? 'openai/gpt-oss-120b';
      return openAiCompatible('groq', 'https://api.groq.com/openai/v1/chat/completions', apiKey, groqModel, f, groqModel.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {});
    }
    case 'openrouter':
      return openAiCompatible(
        'openrouter',
        'https://openrouter.ai/api/v1/chat/completions',
        apiKey,
        model ?? 'meta-llama/llama-3.3-70b-instruct:free',
        f,
      );
    default:
      return gemini(apiKey, model ?? 'gemini-3.8-flash', f);
  }
}

/** Models sometimes wrap JSON in fences or add prose; take the outermost object. */
export function parseLlmJson(raw: string): unknown {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new LlmError('No JSON object in LLM output');
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new LlmError('LLM output was not valid JSON');
  }
}
