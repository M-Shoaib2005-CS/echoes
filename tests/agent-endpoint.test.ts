import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiRequest, ApiResponse } from '../api/_lib/http';
import { LlmError, type LlmProvider } from '../api/_lib/llm';
import { createQlooSource } from '../api/_lib/qloo/source';
import { resetPipelineCaches } from '../api/_lib/pipeline';
import { PERSONAS } from '../shared/personas';
import { resolveSeeds } from '../scripts/resolve';

const state = vi.hoisted(() => ({ llm: null as LlmProvider | null }));
vi.mock('../api/_lib/runtime', async () => {
  const { createQlooSource: make } = await import('../api/_lib/qloo/source');
  const { IpCap } = await import('../api/_lib/limiter');
  const qloo = make({ mode: 'mock', recorded: null });
  return { getRuntime: () => ({ qloo, llm: state.llm }), sessionCap: new IpCap(1000, 60_000), searchCap: new IpCap(1000, 60_000) };
});
const { default: handler } = await import('../api/agent');

const qloo = createQlooSource({ mode: 'mock', recorded: null });
beforeEach(() => {
  resetPipelineCaches();
  state.llm = null;
});

async function call(body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: Record<string, unknown> }> {
  let status = 0;
  let json: unknown;
  const res: ApiResponse = { status: (c) => ((status = c), res), json: (b) => void (json = b), setHeader: () => undefined };
  const req: ApiRequest = { method: 'POST', headers, query: {}, body };
  await handler(req, res);
  return { status, json: json as Record<string, unknown> };
}
const valid = async (instruction = 'more ghazal please') => {
  const p = PERSONAS[0]!;
  return { nickname: p.nickname, bornDecade: p.bornDecade, seeds: await resolveSeeds(qloo, p.seeds), instruction };
};
const scriptedLlm = (): LlmProvider => ({
  name: 'scripted',
  async complete({ user }) {
    let ctx: { step: number; history: { observation: { items?: { id: string }[] } }[] };
    try {
      ctx = JSON.parse(user);
    } catch {
      throw new LlmError('plan prompt', 429); // plan writing falls back to the template
    }
    if (ctx.step === 1) return JSON.stringify({ tool: 'recommend', input: { domain: 'artist' } });
    const ids = (ctx.history[0]?.observation.items ?? []).slice(0, 3).map((i) => i.id);
    return JSON.stringify({ tool: 'finish', input: { picks: { artist: ids } } });
  },
});

describe('POST /api/agent', () => {
  it('runs the agent and returns a session with its trace', async () => {
    state.llm = scriptedLlm();
    const { status, json } = await call(await valid());
    expect(status).toBe(200);
    expect((json.agent as { finishedBy: string; steps: unknown[] }).finishedBy).toBe('agent');
    expect((json.agent as { steps: unknown[] }).steps).toHaveLength(2);
    expect((json.items as unknown[]).length).toBe(3);
  });
  it('explains kindly when no AI service is configured', async () => {
    const { status, json } = await call(await valid());
    expect(status).toBe(503);
    expect((json.error as { code: string }).code).toBe('no_llm');
  });
  it('rejects a missing or tiny instruction', async () => {
    state.llm = scriptedLlm();
    const body = await valid();
    expect((await call({ ...body, instruction: '' })).status).toBe(400);
    expect((await call({ ...body, instruction: 'a' })).status).toBe(400);
    const { instruction: _drop, ...noInstruction } = body;
    expect((await call(noInstruction)).status).toBe(400);
  });
  it('refuses cross-site requests', async () => {
    state.llm = scriptedLlm();
    expect((await call(await valid(), { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });
  it('reports a quota error from the AI provider as a friendly 503', async () => {
    state.llm = { name: 'q', complete: async () => { throw new LlmError('quota', 429); } };
    const { status, json } = await call(await valid());
    // The agent falls back to the standard session on quota errors, so this still succeeds.
    expect(status).toBe(200);
    expect((json.agent as { finishedBy: string }).finishedBy).toBe('error');
    expect(JSON.stringify(json.notices)).toMatch(/standard session/);
  });
});
