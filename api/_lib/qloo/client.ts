// ALL Qloo HTTP lives in this file. Endpoint names and parameters below come from public
// hackathon repos and are unconfirmed; every guess is marked TODO(verify).
import type { Domain, ItemDomain } from '../../../shared/types';
import { callBudget, outboundLimiter, withRetry, type CallBudget, type RateLimiter } from '../limiter';
import { typeUrn } from './normalize';

export const DEFAULT_BASE_URL = 'https://hackathon.api.qloo.com';

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind: 'http' | 'budget' | 'config' | 'network' = 'http',
  ) {
    super(message);
  }
}

export interface QlooConfig {
  apiKey: string;
  baseUrl: string;
}
export interface ClientDeps {
  fetchImpl?: typeof fetch;
  limiter?: RateLimiter;
  budget?: CallBudget;
  sleep?: (ms: number) => Promise<void>;
}
export interface InsightsParams {
  domain: ItemDomain;
  signalIds: string[];
  excludeIds: string[];
  take: number;
  city?: string;
  /** Release-year window for films and TV. Confirmed by smoke test (films 1994-2016 became 1950-1975). Retried without on a 4xx anyway. */
  yearMin?: number;
  yearMax?: number;
  /** Tag ids as a soft signal. Smoke test: UNRELIABLE on its own (returned unrelated artists). Not exposed to the agent. */
  signalTagIds?: string[];
  /** Tag ids as a hard filter. Confirmed by smoke test (ghazal tag returned ghazal singers). */
  tagIds?: string[];
  /** Not sent to Qloo; lets normalize turn explainability ids into names. */
  nameById?: Record<string, string>;
}
type Params = Record<string, string | number | boolean>;

export function insightsQuery(p: InsightsParams): Params {
  const q: Params = {
    'filter.type': typeUrn(p.domain),
    'feature.explainability': true,
    take: p.take,
    sort_by: 'affinity', // accepted by the API (no error); results already arrive by affinity
  };
  if (p.signalIds.length) q['signal.interests.entities'] = p.signalIds.join(','); // confirmed: comma-separated ids
  if (p.excludeIds.length) q['filter.exclude.entities'] = p.excludeIds.join(',');
  if (p.domain === 'place' && p.city) q['filter.location.query'] = p.city;
  if (p.signalTagIds?.length) q['signal.interests.tags'] = p.signalTagIds.join(',');
  if (p.tagIds?.length) q['filter.tags'] = p.tagIds.join(','); // confirmed
  if (p.yearMin !== undefined) q['filter.release_year.min'] = p.yearMin; // confirmed
  if (p.yearMax !== undefined) q['filter.release_year.max'] = p.yearMax; // confirmed
  return q;
}

export function searchQuery(query: string, domain: Domain | undefined, take: number): Params {
  const types = domain ? typeUrn(domain) : (['artist', 'movie', 'tv_show'] as const).map(typeUrn).join(','); // confirmed: comma-separated types
  return { query, types, take };
}

export async function qlooGet(path: string, params: Params, cfg: QlooConfig, deps: ClientDeps = {}): Promise<unknown> {
  const f = deps.fetchImpl ?? fetch;
  const limiter = deps.limiter ?? outboundLimiter;
  const budget = deps.budget ?? callBudget;
  const url = new URL(path, cfg.baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  return withRetry(
    async () => {
      if (!budget.spend()) throw new QlooError('Monthly Qloo call budget reached on this instance', undefined, 'budget');
      return limiter.schedule(async () => {
        let res: Response;
        try {
          res = await f(url.toString(), { headers: { 'X-Api-Key': cfg.apiKey, Accept: 'application/json' } });
        } catch {
          throw new QlooError('Could not reach Qloo', undefined, 'network');
        }
        if (!res.ok) throw new QlooError(`Qloo HTTP ${res.status}`, res.status);
        const json: unknown = await res.json().catch(() => null);
        if (json && typeof json === 'object' && (json as { success?: unknown }).success === false) {
          throw new QlooError('Qloo reported an unsuccessful response', res.status);
        }
        return json;
      });
    },
    {
      tries: 2,
      baseMs: 400,
      sleep: deps.sleep,
      shouldRetry: (e) => e instanceof QlooError && e.status !== undefined && (e.status === 429 || e.status >= 500),
    },
  );
}

export const searchRaw = (query: string, domain: Domain | undefined, take: number, cfg: QlooConfig, deps?: ClientDeps) =>
  qlooGet('/search', searchQuery(query, domain, take), cfg, deps); // TODO(verify): /search

export const insightsRaw = (p: InsightsParams, cfg: QlooConfig, deps?: ClientDeps) =>
  qlooGet('/v2/insights', insightsQuery(p), cfg, deps);

export const tagsRaw = (query: string, cfg: QlooConfig, deps?: ClientDeps, take = 8) =>
  qlooGet('/v2/tags', { 'filter.query': query, 'feature.semantic_search': true, take }, cfg, deps); // confirmed by smoke test
