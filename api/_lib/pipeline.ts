import { compareKey, computeCompare } from '../../shared/compare';
import { buildExclusions, buildSignals } from '../../shared/feedback';
import { normName } from '../../shared/text';
import type { CompareResult, DataSource, Item, LlmOnlyItem, Seed, SessionRequest, SessionResponse, YearFilter } from '../../shared/types';
import { DOMAINS } from '../../shared/types';
import { DedupedCache, requestKey, TtlLru } from './cache';
import { askLlmOnly } from './compareLlm';
import { ApiError } from './http';
import { LlmError, type LlmProvider } from './llm';
import { generatePlan, type PlanResult } from './plan';
import { QlooError } from './qloo/client';
import type { QlooResult, QlooSource } from './qloo/source';
import { dedupe, eraWindow, selectSession, trimItem } from './rank';

const TAKE = 20;
const MIN = 60_000;
let planCache = new DedupedCache<PlanResult>(new TtlLru(100, 30 * MIN));
export const resetPipelineCaches = (): void => {
  planCache = new DedupedCache<PlanResult>(new TtlLru(100, 30 * MIN));
};

export interface Deps {
  qloo: QlooSource;
  llm: LlmProvider | null;
}
export interface Candidates {
  shown: Item[];
  full: Item[];
  outings: Item[];
  source: DataSource;
  yearFilter: YearFilter;
  notices: string[];
}

/** The weakest provenance wins, so mock or cached data is never labelled live. */
export function mergeSources(list: DataSource[]): DataSource {
  return list.find((s) => s.mode === 'mock') ?? list.find((s) => s.mode === 'recorded') ?? { mode: 'live' };
}

export async function fetchCandidates(req: SessionRequest, qloo: QlooSource): Promise<Candidates> {
  const loved = req.feedback?.loved ?? [];
  const signals = buildSignals(req.seeds, loved);
  const excludeIds = buildExclusions(req.feedback?.upsetIds ?? [], signals.map((s) => s.id));
  const nameById = Object.fromEntries(signals.map((s) => [s.id, s.name]));
  const base = { signalIds: signals.map((s) => s.id), excludeIds, take: TAKE, nameById };

  let results: QlooResult[];
  let place: QlooResult | null = null;
  try {
    [results, place] = await Promise.all([
      Promise.all(
        DOMAINS.map((domain) => {
          // Qloo's film/TV picks skew modern, so ask for the person's era up front (code re-checks years too).
          const [yearMin, yearMax] = req.bornDecade !== undefined && domain !== 'artist' ? eraWindow(req.bornDecade) : [undefined, undefined];
          return qloo.insights({ ...base, domain, yearMin, yearMax });
        }),
      ),
      req.city ? qloo.insights({ ...base, domain: 'place', take: 6, city: req.city, excludeIds: [] }).catch(() => null) : Promise.resolve(null),
    ]);
  } catch (e) {
    if (e instanceof QlooError) {
      throw new ApiError(503, 'qloo_unavailable', "Qloo's taste data isn't reachable right now, and there's no saved copy for these favourites. Try a ready-made session, or try again in a minute.");
    }
    throw e;
  }

  const byDomain = Object.fromEntries(DOMAINS.map((d, i) => [d, results[i]!.items]));
  const { shown, full, yearFilter } = selectSession(byDomain, {
    excludeIds: new Set([...excludeIds, ...req.seeds.map((s) => s.id), ...loved.map((l) => l.id)]),
    excludeNames: new Set([...req.seeds, ...loved].map((s) => normName(s.name))),
    bornDecade: req.bornDecade,
  });
  if (!shown.length) {
    throw new ApiError(404, 'no_matches', "Qloo didn't return matches for these favourites. Try adding another favourite or a different spelling.");
  }

  const source = mergeSources([...results.map((r) => r.source), ...(place ? [place.source] : [])]);
  const notices: string[] = [];
  if (source.mode === 'recorded') notices.push('Live Qloo data was unavailable, so this shows Qloo responses recorded earlier.');
  for (const d of DOMAINS) {
    const n = shown.filter((i) => i.domain === d).length;
    if (n < 3) notices.push(`Only ${n} ${d === 'artist' ? 'music' : d === 'movie' ? 'film' : 'TV'} suggestion${n === 1 ? '' : 's'} found for these favourites.`);
  }
  const outings = dedupe(place?.items ?? []).slice(0, 2).map(trimItem);
  return { shown, full, outings, source, yearFilter, notices };
}

export async function runSession(req: SessionRequest, deps: Deps): Promise<SessionResponse> {
  const t0 = Date.now();
  const c = await fetchCandidates(req, deps.qloo);
  const t1 = Date.now();
  const key = requestKey({ n: req.nickname, d: req.bornDecade, ids: c.shown.map((i) => i.id), o: c.outings.map((o) => o.id) });
  const planned = await planCache.getOrCompute(
    key,
    () => generatePlan(deps.llm, { nickname: req.nickname, bornDecade: req.bornDecade, items: c.shown, outings: c.outings }),
    (r) => (r.source === 'template' ? MIN : undefined),
  );
  console.log(`[session] qloo ${t1 - t0}ms, plan ${Date.now() - t1}ms (${planned.source}), source ${c.source.mode}`);
  return {
    items: c.shown,
    outings: c.outings,
    plan: planned.plan,
    planSource: planned.source,
    source: c.source,
    notices: planned.notice ? [...c.notices, planned.notice] : c.notices,
    yearFilter: c.yearFilter,
  };
}

/**
 * For AI-only titles Qloo did not recommend, ask Qloo's search whether it knows them at all.
 * That separates "in the catalogue but not a fit for these favourites" from "not found".
 * Replayed (recorded) data cannot answer, so those titles are reported as unchecked, never as missing.
 */
export async function catalogueCheck(
  qloo: QlooSource,
  llmItems: LlmOnlyItem[],
  known: { shown: Item[]; full: Item[]; seeds: Seed[] },
): Promise<{ found: Set<string>; unchecked: Set<string> }> {
  const knownKeys = new Set([...known.shown, ...known.full, ...known.seeds].map((i) => compareKey(i.domain, i.name)));
  const pending = llmItems.filter((it) => !knownKeys.has(compareKey(it.domain, it.name)));
  const found = new Set<string>();
  const unchecked = new Set<string>();
  await Promise.all(
    pending.map(async (it) => {
      const k = compareKey(it.domain, it.name);
      if (qloo.mode === 'recorded') return void unchecked.add(k);
      try {
        const { items } = await qloo.search(it.name, it.domain);
        if (items.some((i) => i.domain === it.domain && normName(i.name) === normName(it.name))) found.add(k);
      } catch {
        unchecked.add(k);
      }
    }),
  );
  return { found, unchecked };
}

export async function runCompare(req: SessionRequest, deps: Deps): Promise<CompareResult> {
  if (!deps.llm) throw new ApiError(503, 'no_llm', 'The comparison needs the AI writer, which is not set up on this server.');
  const c = await fetchCandidates(req, deps.qloo);
  let llmItems: LlmOnlyItem[];
  try {
    llmItems = await askLlmOnly(deps.llm, req);
  } catch (e) {
    if (e instanceof LlmError) console.warn(`[compare] AI request failed: ${e.message}`);
    if (e instanceof LlmError) {
      const quota = e.status === 429;
      throw new ApiError(
        503,
        quota ? 'llm_quota' : 'llm_unavailable',
        quota
          ? "The AI provider's free-tier limit was reached. Wait a minute (per-minute limit) or until tomorrow (daily limit), or switch LLM_PROVIDER to groq or openrouter."
          : 'The AI writer is unavailable right now. Please try the comparison again in a minute.',
      );
    }
    throw e;
  }
  const catalogue = await catalogueCheck(deps.qloo, llmItems, { shown: c.shown, full: c.full, seeds: req.seeds });
  return computeCompare({ llmItems, seeds: req.seeds, shown: c.shown, full: c.full, llmSource: 'llm', source: c.source, catalogue });
}
