import { describe, expect, it } from 'vitest';
import { detectFlatter, lovedRatio, lovedSeries } from '../shared/trend';
import type { Rating } from '../shared/types';

const r = (...v: Rating[]): Record<string, Rating> => Object.fromEntries(v.map((x, i) => [`i${i}`, x]));

describe('trend', () => {
  it('ignores sessions with too few ratings', () => {
    expect(lovedRatio(r('loved', 'upset'))).toBeNull();
    expect(lovedRatio(r('loved', 'neutral', 'upset', 'loved'))).toBe(0.5);
  });
  it('builds a series from rated sessions only', () => {
    expect(lovedSeries([{ ratings: r('loved', 'loved', 'loved') }, { ratings: {} }, { ratings: r('loved', 'neutral', 'neutral') }])).toEqual([1, 1 / 3]);
  });
  it('flags a steady decline across three sessions', () => {
    expect(detectFlatter([0.8, 0.6, 0.4])).toBe(true);
  });
  it('does not flag short, flat, rising or tiny dips', () => {
    expect(detectFlatter([0.8, 0.4])).toBe(false);
    expect(detectFlatter([0.5, 0.5, 0.5])).toBe(false);
    expect(detectFlatter([0.4, 0.6, 0.8])).toBe(false);
    expect(detectFlatter([0.8, 0.75, 0.7])).toBe(false);
    expect(detectFlatter([0.2, 0.9, 0.6, 0.5, 0.45])).toBe(false);
  });
});
