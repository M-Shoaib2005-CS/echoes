import { beforeEach, describe, expect, it } from 'vitest';
import { catalogueCheck, resetPipelineCaches, runCompare, runSession } from '../api/_lib/pipeline';
import type { InsightsParams } from '../api/_lib/qloo/client';
import { createQlooSource, type QlooSource } from '../api/_lib/qloo/source';
import { PERSONAS } from '../shared/personas';
import type { Seed, SessionRequest } from '../shared/types';
import { resolveSeeds } from '../scripts/resolve';
import { ApiError } from '../api/_lib/http';

const qloo = createQlooSource({ mode: 'mock', recorded: null });
beforeEach(resetPipelineCaches);

async function request(): Promise<SessionRequest> {
  const p = PERSONAS[0]!;
  return { nickname: p.nickname, city: p.city, bornDecade: p.bornDecade, seeds: await resolveSeeds(qloo, p.seeds) };
}

describe('runSession (mock source, no LLM)', () => {
  it('returns a grounded template plan, labels data as mock, and never shows seeds', async () => {
    const req = await request();
    const res = await runSession(req, { qloo, llm: null });
    expect(res.source.mode).toBe('mock');
    expect(res.planSource).toBe('template');
    expect(res.items.length).toBeGreaterThan(5);
    const seedNames = new Set(req.seeds.map((s) => s.name));
    expect(res.items.some((i) => seedNames.has(i.name))).toBe(false);
    const planIds = res.plan.segments.flatMap((s) => s.items.map((i) => i.id));
    expect(planIds.sort()).toEqual(res.items.map((i) => i.id).sort());
    expect(res.items.some((i) => i.reasons?.length)).toBe(true);
    expect(res.outings.length).toBeGreaterThan(0);
  });

  it('turns feedback into signals and exclusions and never re-shows upset items', async () => {
    const req = await request();
    const first = await runSession(req, { qloo, llm: null });
    const loved: Seed[] = first.items.slice(0, 2).map((i) => ({ id: i.id, name: i.name, domain: i.domain as Seed['domain'] }));
    const upset = first.items.slice(2, 4).map((i) => i.id);

    const calls: InsightsParams[] = [];
    const spy: QlooSource = { ...qloo, insights: (p) => (calls.push(p), qloo.insights(p)) };
    const next = await runSession({ ...req, feedback: { loved, upsetIds: upset } }, { qloo: spy, llm: null });

    const nonPlace = calls.filter((c) => c.domain !== 'place');
    expect(nonPlace.length).toBe(3);
    for (const c of nonPlace) {
      expect(c.signalIds.slice(0, 2)).toEqual(loved.map((l) => l.id));
      expect(c.excludeIds).toEqual(upset);
    }
    const ids = next.items.map((i) => i.id);
    expect(ids.some((id) => upset.includes(id))).toBe(false);
    expect(ids.some((id) => loved.some((l) => l.id === id))).toBe(false);
  });

  it('fails kindly when Qloo has nothing', async () => {
    const empty: QlooSource = { ...qloo, insights: async () => ({ items: [], source: { mode: 'mock' } }) };
    const err = await runSession(await request(), { qloo: empty, llm: null }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
  });
});

describe('runCompare', () => {
  it('needs an LLM and says so kindly', async () => {
    const err = await runCompare(await request(), { qloo, llm: null }).catch((e: unknown) => e);
    expect((err as ApiError).code).toBe('no_llm');
  });
  it('computes the comparison from an LLM list', async () => {
    const llm = {
      name: 'fake',
      complete: async () => JSON.stringify({ artists: [{ name: 'Ella Fitzgerald' }], movies: [{ name: 'Invented' }], tv_shows: [{ name: 'Fawlty Towers' }] }),
    };
    const r = await runCompare(await request(), { qloo, llm });
    expect(r.stats.llmTotal).toBe(3);
    expect(r.rows.find((x) => x.name === 'Invented')?.status).toBe('not-found');
    // In the (mock) catalogue but unrelated to these favourites: must not be called "not found".
    expect(r.rows.find((x) => x.name === 'Fawlty Towers')?.status).toBe('in-catalogue');
  });
});

describe('catalogueCheck with replayed data', () => {
  it('reports titles as unchecked, never as missing, when only recorded data is available', async () => {
    const recordedLike: QlooSource = { ...qloo, mode: 'recorded', search: async () => ({ items: [], source: { mode: 'recorded' } }) };
    const out = await catalogueCheck(recordedLike, [{ name: 'Some Title', domain: 'movie' }], { shown: [], full: [], seeds: [] });
    expect(out.found.size).toBe(0);
    expect([...out.unchecked]).toEqual(['movie|some title']);
  });
});
