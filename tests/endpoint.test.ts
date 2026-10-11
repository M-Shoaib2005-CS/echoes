import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/agent';
import { LlmError, type LlmProvider } from '../api/_lib/llm';
import { resetPipelineCaches } from '../api/_lib/pipeline';
import { createQlooSource } from '../api/_lib/qloo/source';
import { PERSONAS } from '../shared/personas';
import type { SessionResponse } from '../shared/types';
import { resolveSeeds } from '../scripts/resolve';

const state = vi.hoisted(() => ({ llm: null as LlmProvider | null }));
vi.mock('../api/_lib/runtime', async () => {
  const { createQlooSource: make } = await import('../api/_lib/qloo/source');
  const { IpCap } = await import('../api/_lib/limiter');
  const qloo = make({ mode: 'mock', recorded: null });
  return { getRuntime: () => ({ qloo, llm: state.llm }), sessionCap: new IpCap(1000, 60_000), searchCap: new IpCap(1000, 60_000) };
});

const qloo = createQlooSource({ mode: 'mock', recorded: null });
beforeEach(() => {
  resetPipelineCaches();
  state.llm = null;
});

async function post(body: unknown, headers: Record<string, string> = {}) {
  let status = 0;
  let json: unknown;
  const res = {
    status(c: number) { status = c; return res; },
    json(b: unknown) { json = b; },
    setHeader() { return undefined; },
  };
  await handler({ method: 'POST', headers, query: {}, body }, res);
  return { status, json };
}
async function validBody(extra: object = {}) {
  const p = PERSONAS[0]!;
  return { nickname: p.nickname, bornDecade: p.bornDecade, seeds: await resolveSeeds(qloo, p.seeds), instruction: 'more ghazal please', ...extra };
}
const errorCode = (j: unknown) => (j as { error: { code: string } }).error.code;

describe('POST /api/agent', () => {
  it('returns a session with the agent trace', async () => {
    state.llm = {
      name: 'scripted',
      async complete({ user }) {
        let ctx: { step: number; history: { observation: { items?: { id: string }[] } }[] };
        try { ctx = JSON.parse(user); } catch { throw new LlmError('plan prompt', 429); }
        if (ctx.step === 1) return JSON.stringify({ tool: 'recommend', input: { domain: 'artist' } });
        return JSON.stringify({ tool: 'finish', input: { picks: { artist: ctx.history[0]!.observation.items!.slice(0, 3).map((i) => i.id) } } });
      },
    };
    const { status, json } = await post(await validBody());
    expect(status).toBe(200);
    const res = json as SessionResponse;
    expect(res.agent?.steps.map((s) => s.tool)).toEqual(['recommend', 'finish']);
    expect(res.items).toHaveLength(3);
  });

  it('asks for an instruction', async () => {
    const { status, json } = await post(await validBody({ instruction: 'x' }));
    expect(status).toBe(400);
    expect(errorCode(json)).toBe('invalid');
  });

  it('says so kindly when no AI service is configured', async () => {
    const { status, json } = await post(await validBody());
    expect(status).toBe(503);
    expect(errorCode(json)).toBe('no_llm');
  });

  it('rejects cross-site requests', async () => {
    state.llm = { name: 'x', complete: async () => '{}' };
    const { status } = await post(await validBody(), { 'sec-fetch-site': 'cross-site' });
    expect(status).toBe(403);
  });

  it('turns a provider quota error into a friendly message when the agent cannot recover', async () => {
    state.llm = { name: 'x', complete: async () => { throw new LlmError('quota', 429); } };
    const { status, json } = await post(await validBody());
    // The agent falls back to the standard session, so the caregiver still gets a result.
    expect(status).toBe(200);
    expect((json as SessionResponse).agent?.finishedBy).toBe('error');
  });
});
