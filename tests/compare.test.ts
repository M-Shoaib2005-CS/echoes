import { describe, expect, it } from 'vitest';
import { computeCompare } from '../shared/compare';
import type { Item, LlmOnlyItem, Seed } from '../shared/types';

const shown: Item[] = [
  { id: '1', name: 'Casablanca', domain: 'movie', reasons: ['Seed Film'] },
  { id: '2', name: 'Roman Holiday', domain: 'movie' },
  { id: '3', name: 'Ella Fitzgerald', domain: 'artist' },
];
const full: Item[] = [...shown, { id: '4', name: 'Ben-Hur', domain: 'movie' }];
const seeds: Seed[] = [{ id: 's', name: 'Seed Film', domain: 'movie' }];
const base = { seeds, shown, full, llmSource: 'llm' as const, source: { mode: 'mock' as const } };

describe('computeCompare', () => {
  it('counts overlap, wider matches, misses and seeds honestly', () => {
    const llmItems: LlmOnlyItem[] = [
      { name: 'casablanca', domain: 'movie' }, { name: 'The Ben Hur', domain: 'movie' },
      { name: 'Invented Movie', domain: 'movie' }, { name: 'Seed Film', domain: 'movie' },
    ];
    const r = computeCompare({ ...base, llmItems });
    expect(r.rows.map((x) => x.status)).toEqual(['in-shown', 'in-qloo', 'not-found', 'seed']);
    expect(r.stats).toMatchObject({ llmTotal: 3, overlapShown: 1, inQlooResults: 2, notFound: 1, qlooShown: 3, qlooUnique: 2, qlooWithReasons: 1 });
    expect(r.summary).toContain('could not be found in Qloo at all');
    expect(r.summary).not.toMatch(/hallucinat/i);
  });
  it('matches the wider result set and says so when lists are similar', () => {
    const r = computeCompare({ ...base, llmItems: [{ name: 'Ben-Hur', domain: 'movie' }, { name: 'Casablanca', domain: 'movie' }, { name: 'Roman Holiday', domain: 'movie' }] });
    expect(r.rows[0]!.status).toBe('in-qloo');
    expect(r.verdict).toBe('similar');
    expect(r.summary).toContain('quite similar');
  });
  it('reports a different list as different', () => {
    expect(computeCompare({ ...base, llmItems: [{ name: 'A', domain: 'movie' }, { name: 'B', domain: 'movie' }] }).verdict).toBe('different');
  });
  it('separates catalogue-only and unchecked titles from truly missing ones', () => {
    const k = (n: string) => `movie|${n.toLowerCase()}`;
    const r = computeCompare({
      ...base,
      llmItems: [{ name: 'Known Elsewhere', domain: 'movie' }, { name: 'Never Heard Of', domain: 'movie' }, { name: 'Maybe', domain: 'movie' }],
      catalogue: { found: new Set([k('Known Elsewhere')]), unchecked: new Set([k('Maybe')]) },
    });
    expect(r.rows.map((x) => x.status)).toEqual(['in-catalogue', 'not-found', 'unchecked']);
    expect(r.stats).toMatchObject({ inCatalogue: 1, notFound: 1, unchecked: 1, inQlooResults: 0 });
    expect(r.summary).toContain("exist in Qloo's catalogue but were not recommended");
    expect(r.summary).toContain('not checked against Qloo');
  });
});
