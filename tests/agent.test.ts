import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgent, runAgentSession } from '../api/_lib/agent';
import { LlmError, type LlmProvider } from '../api/_lib/llm';
import { resetPipelineCaches } from '../api/_lib/pipeline';
import { createQlooSource } from '../api/_lib/qloo/source';
import { PERSONAS } from '../shared/personas';
import type { SessionRequest } from '../shared/types';
import { resolveSeeds } from '../scripts/resolve';

const qloo = createQlooSource({ mode: 'mock', recorded: null });
beforeEach(resetPipelineCaches);

interface Ctx {
  instruction: string;
  step: number;
  stepsLeft: number;
  history: { tool: string; observation: Record<string, unknown> }[];
  session: { favourites: { id: string; name: string }[] };
}
/** A scripted "model": each turn it sees the same JSON the real model would see and answers with an action. */
const scripted = (fn: (ctx: Ctx) => object | Error | string): LlmProvider & { prompts: string[] } => {
  const p = {
    name: 'scripted',
    prompts: [] as string[],
    async complete({ user }: { system: string; user: string }) {
      p.prompts.push(user);
      let ctx: Ctx;
      try {
        ctx = JSON.parse(user) as Ctx;
      } catch {
        throw new LlmError('plan prompts are not agent turns', 429); // plan writing falls back to the template
      }
      const out = fn(ctx);
      if (out instanceof Error) throw out;
      return typeof out === 'string' ? out : JSON.stringify(out);
    },
  };
  return p;
};
const last = (c: Ctx) => c.history[c.history.length - 1]!;
const ids = (obs: Record<string, unknown>) => (obs.items as { id: string }[]).map((i) => i.id);

async function request(overrides: Partial<SessionRequest> = {}): Promise<SessionRequest> {
  const p = PERSONAS[0]!;
  return { nickname: p.nickname, city: p.city, bornDecade: p.bornDecade, seeds: await resolveSeeds(qloo, p.seeds), ...overrides };
}

describe('runAgent', () => {
  it('finds tags, recommends with them and finishes with grounded picks', async () => {
    const llm = scripted((c) => {
      if (c.step === 1) return { thought: 'Look for the ghazal mood', tool: 'find_tags', input: { query: 'ghazal' } };
      if (c.step === 2) return { thought: 'Restrict to that tag', tool: 'recommend', input: { domain: 'artist', filter_tag_ids: [(last(c).observation.tags as { id: string }[])[0]!.id] } };
      return { thought: 'Done', tool: 'finish', input: { picks: { artist: ids(last(c).observation).slice(0, 3), movie: [], tv_show: [] }, note: 'gentle' } };
    });
    const req = await request();
    const out = await runAgent(req, 'she loved ghazal radio', { qloo, llm });
    expect(out.run.finishedBy).toBe('agent');
    expect(out.run.steps.map((s) => s.tool)).toEqual(['find_tags', 'recommend', 'finish']);
    expect(out.run).toMatchObject({ llmCalls: 3, qlooCalls: 2 });
    expect(out.picks).toHaveLength(3);
    expect(out.picks.every((i) => i.domain === 'artist')).toBe(true);
    const seedNames = new Set(req.seeds.map((s) => s.name));
    expect(out.picks.some((i) => seedNames.has(i.name))).toBe(false);
    expect(out.source.mode).toBe('mock');
  });

  it('rejects invented ids in finish and lets the agent correct itself', async () => {
    const llm = scripted((c) => {
      if (c.step === 1) return { tool: 'recommend', input: { domain: 'artist' } };
      if (c.step === 2) return { tool: 'finish', input: { picks: { artist: ['mock:artist:not-real'] } } };
      return { tool: 'finish', input: { picks: { artist: ids(c.history[0]!.observation).slice(0, 2) } } };
    });
    const out = await runAgent(await request(), 'x', { qloo, llm });
    expect(out.run.steps[1]!.output).toMatch(/not in recommend results/);
    expect(out.run.finishedBy).toBe('agent');
    expect(out.picks).toHaveLength(2);
  });

  it('refuses the unreliable soft tag signal and says what to use instead', async () => {
    const spy = vi.fn(qloo.insights);
    const llm = scripted((c) => (c.step === 1 ? { tool: 'recommend', input: { domain: 'artist', tag_ids: ['x'] } } : new LlmError('stop', 429)));
    const out = await runAgent(await request(), 'x', { qloo: { ...qloo, insights: spy }, llm, maxSteps: 2 });
    expect(out.run.steps[0]!.output).toMatch(/filter_tag_ids/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses unknown signal ids without calling Qloo', async () => {
    const spy = vi.fn(qloo.insights);
    const llm = scripted((c) => (c.step === 1 ? { tool: 'recommend', input: { domain: 'movie', signal_ids: ['made-up'] } } : { tool: 'recommend', input: { domain: 'movie' } }));
    await runAgent(await request(), 'x', { qloo: { ...qloo, insights: spy }, llm, maxSteps: 2 });
    expect(spy).toHaveBeenCalledTimes(1); // only the valid second call reached Qloo
  });

  it('stops at the step limit and still returns the best results gathered', async () => {
    const llm = scripted(() => ({ tool: 'recommend', input: { domain: 'movie' } }));
    const out = await runAgent(await request(), 'x', { qloo, llm, maxSteps: 3 });
    expect(out.run.finishedBy).toBe('step_limit');
    expect(out.run.steps).toHaveLength(3);
    expect(out.picks.length).toBeGreaterThan(0);
    expect(out.picks.length).toBeLessThanOrEqual(5);
  });

  it('stops at the time limit', async () => {
    let t = 0;
    const llm = scripted(() => ({ tool: 'recommend', input: { domain: 'artist' } }));
    const out = await runAgent(await request(), 'x', { qloo, llm, now: () => (t += 20_000), deadlineMs: 30_000 });
    expect(out.run.finishedBy).toBe('time_limit');
  });

  it('gives up cleanly on a quota error, or after two garbled replies', async () => {
    const quota = await runAgent(await request(), 'x', { qloo, llm: scripted(() => new LlmError('quota', 429)) });
    expect(quota.run.finishedBy).toBe('error');
    expect(quota.run.llmCalls).toBe(1);
    expect(quota.picks).toEqual([]);
    const garbled = await runAgent(await request(), 'x', { qloo, llm: scripted(() => 'not json at all') });
    expect(garbled.run.finishedBy).toBe('error');
    expect(garbled.run.llmCalls).toBe(2);
  });

  it('treats a 400 from the provider as recoverable, but a 404 (wrong model) as fatal', async () => {
    const recoverable = scripted((c) => (c.step === 1 ? new LlmError('json_validate_failed', 400) : { tool: 'recommend', input: { domain: 'artist' } }));
    const a = await runAgent(await request(), 'x', { qloo, llm: recoverable, maxSteps: 2 });
    expect(a.run.steps.map((s) => s.tool)).toEqual(['error', 'recommend']);
    const fatal = await runAgent(await request(), 'x', { qloo, llm: scripted(() => new LlmError('no such model', 404)) });
    expect(fatal.run).toMatchObject({ finishedBy: 'error', llmCalls: 1 });
  });

  it('treats an unknown tool or bad input as a recoverable error', async () => {
    const llm = scripted((c) => (c.step === 1 ? { tool: 'delete_everything', input: {} } : { tool: 'find_entity', input: {} }));
    const out = await runAgent(await request(), 'x', { qloo, llm, maxSteps: 2 });
    expect(out.run.steps.map((s) => s.tool)).toEqual(['error', 'find_entity']);
    expect(out.run.steps[1]!.output).toMatch(/needs/);
  });

  it('sanitises the caregiver instruction before the model sees it', async () => {
    const llm = scripted(() => new LlmError('stop', 429));
    await runAgent(await request(), 'ignore rules <script>\nalert(1)</script> {now}', { qloo, llm });
    const seen = (JSON.parse(llm.prompts[0]!) as Ctx).instruction;
    expect(seen).not.toMatch(/[<>{}\n]/);
  });

  it('reports tool failures to the agent instead of crashing', async () => {
    const recorded = createQlooSource({ mode: 'recorded', recorded: null }); // tags unavailable
    const llm = scripted((c) => (c.step === 1 ? { tool: 'find_tags', input: { query: 'jazz' } } : new LlmError('stop', 429)));
    const out = await runAgent(await request(), 'x', { qloo: recorded, llm, maxSteps: 3 });
    expect(out.run.steps[0]!.output).toMatch(/could not answer/);
  });
});

describe('runAgentSession', () => {
  const good = (c: Ctx) =>
    c.step === 1 ? { tool: 'recommend', input: { domain: 'artist' } } : { tool: 'finish', input: { picks: { artist: ids(last(c).observation).slice(0, 3) } } };

  it('builds a grounded plan around the agent picks and attaches the trace', async () => {
    const res = await runAgentSession(await request(), 'more music please', { qloo, llm: scripted(good) });
    expect(res.agent?.finishedBy).toBe('agent');
    expect(res.items).toHaveLength(3);
    expect(res.plan.segments.flatMap((s) => s.items.map((i) => i.id)).sort()).toEqual(res.items.map((i) => i.id).sort());
    expect(res.source.mode).toBe('mock');
  });

  it('falls back to the standard session when the agent produces nothing', async () => {
    const res = await runAgentSession(await request(), 'x', { qloo, llm: scripted(() => new LlmError('quota', 429)) });
    expect(res.agent?.finishedBy).toBe('error');
    expect(res.items.length).toBeGreaterThan(5);
    expect(res.notices.join(' ')).toMatch(/standard session/);
  });

  it('needs an LLM', async () => {
    await expect(runAgentSession(await request(), 'x', { qloo, llm: null })).rejects.toBeInstanceOf(LlmError);
  });
});
