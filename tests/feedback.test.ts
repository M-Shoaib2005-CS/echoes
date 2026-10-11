import { describe, expect, it } from 'vitest';
import { buildExclusions, buildSignals, collectFeedback, diffSessions } from '../shared/feedback';
import type { Item, Rating, Seed } from '../shared/types';

const seed = (n: number): Seed => ({ id: `s${n}`, name: `Seed ${n}`, domain: 'artist' });
const item = (id: string, reasons?: string[]): Item => ({ id, name: id.toUpperCase(), domain: 'movie', reasons });

describe('buildSignals', () => {
  it('puts loved first, drops duplicates of seeds and caps the list', () => {
    const seeds = [1, 2, 3, 4, 5, 6].map(seed);
    const loved: Seed[] = [...Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, name: `L${i}`, domain: 'movie' as const })), seeds[0]!];
    const out = buildSignals(seeds, loved, 10);
    expect(out).toHaveLength(10);
    expect(out.slice(0, 7).every((s) => s.id.startsWith('l'))).toBe(true);
    expect(out.filter((s) => s.id.startsWith('s'))).toHaveLength(3); // at least three seeds survive
  });
  it('uses all seeds when there is room', () => {
    expect(buildSignals([seed(1), seed(2), seed(3)], [])).toHaveLength(3);
  });
});

describe('buildExclusions', () => {
  it('dedupes and never excludes a current signal', () => {
    expect(buildExclusions(['a', 'a', 'b', 's1'], ['s1'])).toEqual(['a', 'b']);
  });
});

describe('collectFeedback', () => {
  it('lets the newest rating win', () => {
    const items = [item('a'), item('b'), item('c')];
    const old: Record<string, Rating> = { a: 'loved', b: 'loved', c: 'upset' };
    const recent: Record<string, Rating> = { a: 'upset', c: 'loved' };
    const fb = collectFeedback([{ items, ratings: old }, { items, ratings: recent }]);
    expect(fb.loved.map((l) => l.id).sort()).toEqual(['b', 'c']);
    expect(fb.upsetIds).toEqual(['a']);
  });
  it('does not turn outings into signals', () => {
    const fb = collectFeedback([{ items: [{ id: 'p', name: 'Park', domain: 'place' }], ratings: { p: 'loved' } }]);
    expect(fb.loved).toEqual([]);
  });
});

describe('diffSessions', () => {
  it('reports added, removed, upset exclusions and loved drivers', () => {
    const prev = [item('a'), item('b'), item('c')];
    const next = [item('a'), item('d', ['Seed 1', 'Other']), item('e')];
    const d = diffSessions(prev, next, ['b'], ['seed 1']);
    expect(d.added.map((i) => i.id)).toEqual(['d', 'e']);
    expect(d.removed.map((i) => i.id)).toEqual(['b', 'c']);
    expect(d.upsetRemoved.map((i) => i.id)).toEqual(['b']);
    expect(d.drivers).toEqual({ d: ['Seed 1'] });
  });
});
