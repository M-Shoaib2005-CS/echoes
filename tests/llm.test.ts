import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlm, LlmError } from '../api/_lib/llm';

afterEach(() => vi.restoreAllMocks());
const ask = (f: typeof fetch) => createLlm({ LLM_API_KEY: 'k', LLM_PROVIDER: 'groq' }, f)!.complete({ system: 's', user: 'u' });

describe('LLM transport errors', () => {
  it('reports a timeout as status 408 so it is not retried', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = await ask(vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).status).toBe(408);
  });
  it('keeps the underlying network reason in the error for server logs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new TypeError('fetch failed', { cause: new Error('ENOTFOUND api.groq.com') });
    const err = (await ask(vi.fn().mockRejectedValue(failure)).catch((e: unknown) => e)) as LlmError;
    expect(err.message).toContain('fetch failed');
    expect(err.message).toContain('ENOTFOUND');
    expect(err.status).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
  it('carries the HTTP status for provider errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const res = { ok: false, status: 429, text: async () => 'quota' } as Response;
    const err = (await ask(vi.fn().mockResolvedValue(res)).catch((e: unknown) => e)) as LlmError;
    expect(err.status).toBe(429);
  });
});

describe('Groq defaults', () => {
  const bodyFor = async (env: Record<string, string>) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{}' } }] }) } as Response);
    await createLlm({ LLM_API_KEY: 'k', LLM_PROVIDER: 'groq', ...env }, fetchImpl)!.complete({ system: 's', user: 'u' });
    return JSON.parse(String((fetchImpl.mock.calls[0]![1] as { body: string }).body)) as Record<string, unknown>;
  };
  it('defaults to a publicly available gpt-oss model with low reasoning effort', async () => {
    expect(await bodyFor({})).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low' });
  });
  it('respects LLM_MODEL and only adds reasoning effort for gpt-oss models', async () => {
    const body = await bodyFor({ LLM_MODEL: 'some/other-model' });
    expect(body.model).toBe('some/other-model');
    expect(body).not.toHaveProperty('reasoning_effort');
  });
});

describe('Groq forced-JSON failures', () => {
  const ok = (content: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;
  const failed = { ok: false, status: 400, text: async () => '{"error":{"code":"json_validate_failed","failed_generation":""}}' } as Response;

  it('retries once without response_format and returns the plain-text reply', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(ok('{"a":1}'));
    const out = await ask(fetchImpl);
    expect(out).toBe('{"a":1}');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const bodies = fetchImpl.mock.calls.map((c) => JSON.parse(String((c[1] as { body: string }).body)) as Record<string, unknown>);
    expect(bodies[0]).toHaveProperty('response_format');
    expect(bodies[1]).not.toHaveProperty('response_format');
  });
  it('does not retry other 400 errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const other = { ok: false, status: 400, text: async () => 'bad model parameter' } as Response;
    const fetchImpl = vi.fn().mockResolvedValue(other);
    await expect(ask(fetchImpl)).rejects.toBeInstanceOf(LlmError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
