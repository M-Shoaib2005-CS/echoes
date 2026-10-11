import { describe, expect, it } from 'vitest';
import { insightsQuery, QlooError } from '../api/_lib/qloo/client';
import { mockInsightsRaw } from '../api/_lib/qloo/mock';
import { normalizeInsights, normalizeTagInfos } from '../api/_lib/qloo/normalize';
import { createQlooSource } from '../api/_lib/qloo/source';

// Trimmed from the real /v2/tags response for "jazz": same name, several tag types, name with a leading space.
const jazz = { success: true, results: { tags: [
  { id: 'urn:tag:genre:qloo:jazz', name: 'Jazz', type: 'urn:tag:genre:qloo', popularity: 0.99, tags: [] },
  { id: 'urn:tag:genre:music:jazz', name: ' Jazz', type: 'urn:tag:genre:music', properties: { description: 'x' } },
  { name: 'No id' },
] } };

describe('normalizeTagInfos', () => {
  it('keeps ids and types, trims names and skips entries without an id', () => {
    expect(normalizeTagInfos(jazz)).toEqual([
      { id: 'urn:tag:genre:qloo:jazz', name: 'Jazz', type: 'urn:tag:genre:qloo' },
      { id: 'urn:tag:genre:music:jazz', name: 'Jazz', type: 'urn:tag:genre:music' },
    ]);
  });
  it('returns an empty list for odd shapes', () => {
    expect(normalizeTagInfos(null)).toEqual([]);
    expect(normalizeTagInfos({ results: { tags: 'x' } })).toEqual([]);
  });
});

describe('tag parameters', () => {
  it('are sent as soft signals and hard filters only when given', () => {
    const q = insightsQuery({ domain: 'artist', signalIds: ['a'], excludeIds: [], take: 5, signalTagIds: ['t1', 't2'], tagIds: ['t3'] });
    expect(q).toMatchObject({ 'signal.interests.tags': 't1,t2', 'filter.tags': 't3' });
    expect(insightsQuery({ domain: 'artist', signalIds: ['a'], excludeIds: [], take: 5 })).not.toHaveProperty('filter.tags');
  });
});

describe('mock source tags', () => {
  const qloo = createQlooSource({ mode: 'mock', recorded: null });
  it('finds tags by phrase', async () => {
    const r = await qloo.tags('ghazal');
    expect(r.source.mode).toBe('mock');
    expect(r.tags.map((t) => t.id)).toContain('mock-tag:ghazal-qawwali');
  });
  it('lets tags steer and filter recommendations', () => {
    const soft = normalizeInsights(mockInsightsRaw({ domain: 'artist', signalIds: [], excludeIds: [], take: 5, signalTagIds: ['mock-tag:ghazal-qawwali'] }), { fallbackDomain: 'artist' });
    expect(soft.length).toBeGreaterThan(0);
    expect(soft.every((i) => i.tags?.some((t) => /ghazal/i.test(t)))).toBe(true);
    const hard = normalizeInsights(mockInsightsRaw({ domain: 'movie', signalIds: [], excludeIds: [], take: 10, signalTagIds: ['mock-tag:romance'], tagIds: ['mock-tag:musical'] }), { fallbackDomain: 'movie' });
    expect(hard.length).toBeGreaterThan(0);
    expect(hard.every((i) => i.tags?.some((t) => /musical/i.test(t)))).toBe(true);
  });
  it('is unavailable (not empty) when replaying recorded data', async () => {
    const recorded = createQlooSource({ mode: 'recorded', recorded: null });
    await expect(recorded.tags('jazz')).rejects.toBeInstanceOf(QlooError);
  });
});
