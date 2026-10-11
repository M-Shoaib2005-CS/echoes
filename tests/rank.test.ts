import { describe, expect, it } from 'vitest';
import { applyYearFilter, dedupe, rankSearchResults, selectSession, trimItem } from '../api/_lib/rank';
import type { Item } from '../shared/types';

const mk = (id: string, name: string, domain: Item['domain'], affinity?: number, year?: number): Item => ({ id, name, domain, affinity, year });

describe('dedupe', () => {
  it('keeps the higher-affinity copy of a repeated title and drops repeated ids', () => {
    const out = dedupe([mk('1', 'The Godfather', 'movie', 0.5), mk('2', 'Godfather', 'movie', 0.9), mk('2', 'Other', 'movie', 0.1)]);
    expect(out.map((i) => i.id)).toEqual(['2']);
  });
});

describe('selectSession', () => {
  const none = { excludeIds: new Set<string>(), excludeNames: new Set<string>() };
  it('removes seeds and exclusions by id and by name, sorts by affinity, caps per domain', () => {
    const artists = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x, i) => mk(x, `Artist ${x}`, 'artist', i / 10));
    const { shown } = selectSession(
      { artist: artists },
      { excludeIds: new Set(['g']), excludeNames: new Set(['artist f']), perDomain: 5, maxTotal: 15 },
    );
    expect(shown.map((i) => i.id)).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('keeps Qloo order when affinity is missing', () => {
    const { shown } = selectSession({ movie: [mk('1', 'One', 'movie'), mk('2', 'Two', 'movie')] }, none);
    expect(shown.map((i) => i.id)).toEqual(['1', '2']);
  });

  it('caps the total', () => {
    const many = (d: Item['domain']) => Array.from({ length: 9 }, (_, i) => mk(`${d}${i}`, `${d} ${i}`, d, 0.5));
    const { shown } = selectSession({ artist: many('artist'), movie: many('movie'), tv_show: many('tv_show') }, { ...none, maxTotal: 12 });
    expect(shown).toHaveLength(12);
  });
});

describe('trimItem', () => {
  it('drops unneeded fields and limits arrays', () => {
    const t = trimItem({ ...mk('1', 'A', 'artist', 0.123456), popularity: 0.5, tags: ['1', '2', '3', '4', '5'], reasons: ['a', 'b', 'c', 'd'] });
    expect(t).toEqual({ id: '1', name: 'A', domain: 'artist', affinity: 0.12, tags: ['1', '2', '3', '4'], reasons: ['a', 'b', 'c'] });
  });
});

describe('applyYearFilter', () => {
  const items = [mk('1', 'Old', 'movie', 1, 1935), mk('2', 'Fit1', 'movie', 1, 1955), mk('3', 'Fit2', 'movie', 1, 1960), mk('4', 'Fit3', 'movie', 1, 1965)];
  it('filters by an era window when years exist', () => {
    const r = applyYearFilter(items, 1940);
    expect(r.filter.active).toBe(true);
    expect(r.items.map((i) => i.id)).toEqual(['2', '3', '4']);
  });
  it('states honestly when years are missing', () => {
    const r = applyYearFilter(items.map((i) => ({ ...i, year: undefined })), 1940);
    expect(r.filter.active).toBe(false);
    expect(r.filter.note).toMatch(/nothing was filtered/);
    expect(r.items).toHaveLength(4);
  });
  it('relaxes when too few titles remain', () => {
    expect(applyYearFilter(items, 1900).filter.active).toBe(false);
  });
});

describe('rankSearchResults', () => {
  const a = (name: string, popularity: number): Item => ({ id: name, name, domain: 'artist', popularity });
  it('puts the exact artist first and collaboration entries after clean matches', () => {
    const out = rankSearchResults(
      [a('Kishore Kumar, Lata Mangeshkar', 0.5), a('Lata Mangeshkar, Mukesh', 0.46), a('Lata Mangeshkar And Mohd. Rafi', 0.26), a('Lata Mangeshkar', 0.96), a('Lata Mangeshkar Tribute Band', 0.1)],
      'lata mangeshkar',
    );
    expect(out.map((i) => i.name)).toEqual(['Lata Mangeshkar', 'Lata Mangeshkar Tribute Band', 'Lata Mangeshkar, Mukesh', 'Lata Mangeshkar And Mohd. Rafi', 'Kishore Kumar, Lata Mangeshkar']);
  });
  it('does not penalise films whose titles contain "and"', () => {
    const film = (name: string): Item => ({ id: name, name, domain: 'movie' });
    expect(rankSearchResults([film('Pride and Prejudice 2'), film('Pride and Prejudice')], 'pride and prejudice')[0]!.name).toBe('Pride and Prejudice');
  });
});
