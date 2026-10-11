import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeEntity, normalizeInsights, normalizeSearch, normalizeTags } from '../api/_lib/qloo/normalize';

afterEach(() => vi.restoreAllMocks());

describe('normalizeEntity', () => {
  it('maps a full entity', () => {
    const item = normalizeEntity(
      {
        entity_id: 'E1', name: 'Casablanca', type: 'urn:entity:movie', popularity: 0.8,
        properties: { release_year: 1942, image: { url: 'https://img/x.jpg' } },
        tags: [{ name: 'romance' }, 'war'],
        query: { affinity: 0.77, explainability: [{ entity_id: 'S1', name: 'Seven Samurai' }] },
      },
      { nameById: { S1: 'Seven Samurai' } },
    );
    expect(item).toEqual({
      id: 'E1', name: 'Casablanca', domain: 'movie', popularity: 0.8, affinity: 0.77, tags: ['romance', 'war'],
      year: 1942, imageUrl: 'https://img/x.jpg', reasons: ['Seven Samurai'],
    });
  });

  it('degrades on missing or odd fields', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const item = normalizeEntity({ id: 'X', name: 'Thing', type: 'urn:entity:artist', affinity: 7, properties: { release_date: 'nope' }, image: 'javascript:alert(1)' });
    expect(item).toEqual({ id: 'X', name: 'Thing', domain: 'artist' });
  });

  it('parses year from a date string and ignores unmatched explainability', () => {
    const item = normalizeEntity({ entity_id: 'a', name: 'A', type: 'urn:entity:tv_show', release_date: '1979-05-01', explainability: 'who knows' }, { nameById: { S: 'Seed' } });
    expect(item?.year).toBe(1979);
    expect(item?.reasons).toBeUndefined();
  });

  it('uses the fallback domain and rejects entities with no id, name or type', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizeEntity({ entity_id: 'a', name: 'A' }, { fallbackDomain: 'movie' })?.domain).toBe('movie');
    expect(normalizeEntity({ name: 'A', type: 'urn:entity:movie' })).toBeNull();
    expect(normalizeEntity({ entity_id: 'a', name: 'A' })).toBeNull();
    expect(normalizeEntity(null)).toBeNull();
    expect(normalizeEntity('text')).toBeNull();
  });
});

describe('list normalizers never throw', () => {
  it.each([[undefined], [null], ['x'], [{}], [{ results: null }], [{ results: { entities: 'no' } }], [[]]])('handles %j', (raw) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(normalizeInsights(raw)).toEqual([]);
    expect(normalizeSearch(raw)).toEqual([]);
    expect(normalizeTags(raw)).toEqual([]);
  });

  it('accepts entities nested or as a plain array and skips bad rows', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const row = { entity_id: 'a', name: 'A', type: 'urn:entity:artist' };
    expect(normalizeInsights({ results: { entities: [row, null, {}] } })).toHaveLength(1);
    expect(normalizeSearch({ results: [row] })).toHaveLength(1);
  });
});
