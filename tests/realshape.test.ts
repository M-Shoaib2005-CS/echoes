// Shapes below are trimmed from real responses saved by `npm run smoke` (hackathon API, Oct 2026).
import { describe, expect, it, vi } from 'vitest';
import { insightsQuery } from '../api/_lib/qloo/client';
import { normalizeInsights, normalizeSearch, normalizeTags } from '../api/_lib/qloo/normalize';
import { createQlooSource } from '../api/_lib/qloo/source';
import { CallBudget, RateLimiter } from '../api/_lib/limiter';

const SINATRA = 'FC0F8D26-BA80-4D83-8BBF-FC011DC8D241';
const LUCY = '65E28499-5D62-4D74-A0B8-0C60DD6C2358';

const insightsMovie = {
  success: true,
  results: {
    entities: [
      {
        name: 'Roman Holiday', entity_id: 'M1', type: 'urn:entity', subtype: 'urn:entity:movie', popularity: 0.8,
        properties: { release_year: 1953, release_date: '1953-08-27', image: { url: 'https://m.media-amazon.com/x.jpg' } },
        tags: [
          { id: 'urn:tag:keyword:media:discriminatory_law', name: 'Discriminatory law', type: 'urn:tag:keyword:media' },
          { id: 'urn:tag:plot:qloo:bittersweet', name: 'Bittersweet', type: 'urn:tag:plot:qloo' },
          { id: 'urn:tag:genre:media:romance', name: 'Romance', type: 'urn:tag:genre:media' },
          { id: 'urn:tag:genre:media:romance2', name: 'romance', type: 'urn:tag:genre:media' },
        ],
        query: { affinity: 0.91, measurements: { audience_growth: 0 }, explainability: { 'signal.interests.entities': [
          { entity_id: SINATRA, score: 0.1 }, { entity_id: LUCY.toLowerCase(), score: 0.3 }, { entity_id: 'UNKNOWN', score: 0.9 },
        ] } },
      },
    ],
  },
};

describe('real insights shape', () => {
  const [item] = normalizeInsights(insightsMovie, { nameById: { [SINATRA]: 'Frank Sinatra', [LUCY]: 'I Love Lucy' } });
  it('reads the domain from subtype, plus year, image and affinity', () => {
    expect(item).toMatchObject({ id: 'M1', domain: 'movie', year: 1953, affinity: 0.91, imageUrl: 'https://m.media-amazon.com/x.jpg' });
  });
  it('orders reasons by score, matches ids case-insensitively and ignores unknown ids', () => {
    expect(item?.reasons).toEqual(['I Love Lucy', 'Frank Sinatra']);
  });
  it('shows genre first, drops media keywords and duplicate names', () => {
    expect(item?.tags).toEqual(['Romance', 'Bittersweet']);
  });
  it('gives no reasons when no signal names are supplied', () => {
    expect(normalizeInsights(insightsMovie)[0]?.reasons).toBeUndefined();
  });
});

describe('real place, search and tags shapes', () => {
  it('reads place images from properties.images and tolerates missing affinity', () => {
    const [p] = normalizeInsights({ results: { entities: [{ name: 'Hyde Park', entity_id: 'P', type: 'urn:entity', subtype: 'urn:entity:place', properties: { images: [{ url: 'https://lh3.googleusercontent.com/a' }] }, query: { distance: 0 } }] }, warnings: [{ type: 'Could not calculate explainability' }] });
    expect(p).toMatchObject({ domain: 'place', imageUrl: 'https://lh3.googleusercontent.com/a' });
    expect(p?.affinity).toBeUndefined();
  });
  it('reads search results from a plain array with types[]', () => {
    const [a] = normalizeSearch({ results: [{ name: 'Lata Mangeshkar', entity_id: 'D32E', types: ['urn:entity:artist'], properties: { image: { url: 'https://images.qloo.com/i/x.jpg' } }, popularity: 0.95, tags: [{ name: 'Bollywood', type: 'urn:tag:genre' }, { name: 'Devoted', type: 'urn:tag:audience:qloo' }] }] });
    expect(a).toMatchObject({ domain: 'artist', tags: ['Bollywood'] });
  });
  it('reads tag names from results.tags', () => {
    expect(normalizeTags({ success: true, results: { tags: [{ id: 'a', name: ' Jazz', type: 'x' }, { id: 'b', name: 'Jazz', type: 'y' }] } })).toEqual(['Jazz', 'Jazz']);
  });
});

describe('era parameters', () => {
  it('are sent only when set', () => {
    expect(insightsQuery({ domain: 'movie', signalIds: [], excludeIds: [], take: 5, yearMin: 1948, yearMax: 1975 })).toMatchObject({ 'filter.release_year.min': 1948, 'filter.release_year.max': 1975 });
    expect(insightsQuery({ domain: 'movie', signalIds: [], excludeIds: [], take: 5 })).not.toHaveProperty('filter.release_year.min');
  });
  it('retry without them if Qloo answers 4xx, then succeed', async () => {
    const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body }) as Response;
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(400)).mockResolvedValueOnce(res(200, insightsMovie));
    const qloo = createQlooSource({ mode: 'live', apiKey: 'k', fetchImpl, recorded: null, limiter: new RateLimiter(1000), budget: new CallBudget(10) });
    const out = await qloo.insights({ domain: 'movie', signalIds: ['a'], excludeIds: [], take: 5, yearMin: 1948, yearMax: 1975 });
    expect(out.source.mode).toBe('live');
    expect(out.items[0]?.name).toBe('Roman Holiday');
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('filter.release_year.min');
    expect(String(fetchImpl.mock.calls[1]![0])).not.toContain('filter.release_year');
  });
});
