// Chooses between live Qloo, recorded replays and mock data, and applies caching and fallback.
// Mock data is never reported as Qloo data: every result carries its DataSource.
import { normName } from '../../../shared/text';
import type { DataMode, DataSource, Domain, IdSpace, Item, TagInfo } from '../../../shared/types';
import { DedupedCache, requestKey, TtlLru } from '../cache';
import type { CallBudget, RateLimiter } from '../limiter';
import { DEFAULT_BASE_URL, insightsRaw, QlooError, searchRaw, tagsRaw, type InsightsParams, type QlooConfig } from './client';
import { mockInsightsRaw, mockSearchRaw, mockTagsRaw } from './mock';
import { normalizeInsights, normalizeSearch, normalizeTagInfos } from './normalize';
import { findInsights, loadRecorded, type RecordedEntry, type RecordedFile } from './recorded';

export interface QlooResult {
  items: Item[];
  source: DataSource;
}
export interface TagResult {
  tags: TagInfo[];
  source: DataSource;
}
export interface QlooSource {
  readonly mode: DataMode;
  readonly idSpace: IdSpace;
  readonly hasRecorded: boolean;
  search(query: string, domain?: Domain): Promise<QlooResult>;
  insights(p: InsightsParams): Promise<QlooResult>;
  /** Semantic tag search (moods, genres, themes). Not recorded, so unavailable when replaying. */
  tags(query: string): Promise<TagResult>;
}
export interface SourceOptions {
  mode: DataMode;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  budget?: CallBudget;
  recorded?: RecordedFile | null;
  /** Called with every raw live response; used by `npm run record`. */
  onRaw?: (e: RecordedEntry) => void;
}

export function sourceOptionsFromEnv(env: Record<string, string | undefined>): SourceOptions {
  const requested = env.QLOO_MODE;
  const mode: DataMode =
    requested === 'live' || requested === 'recorded' || requested === 'mock' ? requested : env.VERCEL ? 'live' : 'mock';
  return { mode, apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_BASE_URL || DEFAULT_BASE_URL };
}

const MIN = 60_000;

export function createQlooSource(opts: SourceOptions): QlooSource {
  const recorded = opts.recorded === undefined ? loadRecorded() : opts.recorded;
  const searchCache = new DedupedCache<QlooResult>(new TtlLru(300, 60 * MIN));
  const insightsCache = new DedupedCache<QlooResult>(new TtlLru(300, 30 * MIN));
  const tagsCache = new DedupedCache<TagResult>(new TtlLru(200, 60 * MIN));
  const shortTtl = (r: QlooResult) => (r.source.mode === 'recorded' ? MIN : undefined);
  const deps = { fetchImpl: opts.fetchImpl, limiter: opts.limiter, budget: opts.budget };
  const recSource = (): DataSource => ({ mode: 'recorded', recordedAt: recorded?.recordedAt });
  const cfg = (): QlooConfig => {
    if (!opts.apiKey) throw new QlooError('QLOO_API_KEY is not set', undefined, 'config');
    return { apiKey: opts.apiKey, baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL };
  };
  const unavailable = (): never => {
    throw new QlooError('No recorded data available for this request', undefined, 'config');
  };

  const recordedSearch = (q: string, domain?: Domain): QlooResult | null => {
    const entries = recorded?.entries.filter((e) => e.kind === 'search') ?? [];
    if (!entries.length) return null;
    const needle = normName(q);
    const seen = new Set<string>();
    const items = entries
      .flatMap((e) => normalizeSearch(e.response))
      .filter((i) => i.domain !== 'place' && (!domain || i.domain === domain) && normName(i.name).includes(needle))
      .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    return { items, source: recSource() };
  };

  const recordedInsights = (p: InsightsParams): QlooResult | null => {
    const hit = recorded ? findInsights(recorded, p) : null;
    return hit ? { items: normalizeInsights(hit.response, { nameById: p.nameById }), source: recSource() } : null;
  };

  async function withFallback(live: () => Promise<QlooResult>, rec: () => QlooResult | null): Promise<QlooResult> {
    try {
      return await live();
    } catch (e) {
      if (!(e instanceof QlooError)) throw e;
      return rec() ?? Promise.reject(e);
    }
  }

  const doSearch = async (q: string, domain?: Domain): Promise<QlooResult> => {
    if (opts.mode === 'mock') return { items: normalizeSearch(mockSearchRaw(q, domain)), source: { mode: 'mock' } };
    if (opts.mode === 'recorded') return recordedSearch(q, domain) ?? unavailable();
    return withFallback(
      async () => {
        const raw = await searchRaw(q, domain, 8, cfg(), deps);
        opts.onRaw?.({ kind: 'search', query: q, domain, response: raw });
        return { items: normalizeSearch(raw, { fallbackDomain: domain }), source: { mode: 'live' } };
      },
      () => recordedSearch(q, domain),
    );
  };

  const doInsights = async (p: InsightsParams): Promise<QlooResult> => {
    if (opts.mode === 'mock') {
      return { items: normalizeInsights(mockInsightsRaw(p), { fallbackDomain: p.domain, nameById: p.nameById }), source: { mode: 'mock' } };
    }
    if (opts.mode === 'recorded') return recordedInsights(p) ?? unavailable();
    return withFallback(
      async () => {
        let raw: unknown;
        try {
          raw = await insightsRaw(p, cfg(), deps);
        } catch (e) {
          // The era parameters are unconfirmed. If Qloo rejects them, retry without; code filters by year anyway.
          const rejected = e instanceof QlooError && e.status !== undefined && e.status >= 400 && e.status < 500 && e.status !== 429;
          if (!rejected || p.yearMin === undefined) throw e;
          raw = await insightsRaw({ ...p, yearMin: undefined, yearMax: undefined }, cfg(), deps);
        }
        opts.onRaw?.({
          kind: 'insights',
          params: { domain: p.domain, signalIds: p.signalIds, excludeIds: p.excludeIds, city: p.city },
          response: raw,
        });
        return { items: normalizeInsights(raw, { fallbackDomain: p.domain, nameById: p.nameById }), source: { mode: 'live' } };
      },
      () => recordedInsights(p),
    );
  };

  return {
    mode: opts.mode,
    idSpace: opts.mode === 'mock' ? 'mock' : 'qloo',
    hasRecorded: recorded !== null,
    tags: (q) =>
      tagsCache.getOrCompute(requestKey({ m: opts.mode, q }), async (): Promise<TagResult> => {
        if (opts.mode === 'mock') return { tags: normalizeTagInfos(mockTagsRaw(q)), source: { mode: 'mock' } };
        if (opts.mode === 'recorded') return unavailable();
        return { tags: normalizeTagInfos(await tagsRaw(q, cfg(), deps)), source: { mode: 'live' } };
      }),
    search: (q, domain) =>
      searchCache.getOrCompute(requestKey({ m: opts.mode, q, domain }), () => doSearch(q, domain), shortTtl),
    insights: (p) =>
      insightsCache.getOrCompute(
        requestKey({ m: opts.mode, d: p.domain, s: p.signalIds, x: p.excludeIds, t: p.take, c: p.city, y0: p.yearMin, y1: p.yearMax, ts: p.signalTagIds, tf: p.tagIds }),
        () => doInsights(p),
        shortTtl,
      ),
  };
}
