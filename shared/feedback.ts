import type { Changes, Feedback, Item, Rating, Seed } from './types';

export const MAX_SIGNALS = 10;
export const MIN_KEPT_SEEDS = 3;

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/** Signal list for Qloo: loved items first, but always keep a few original favourites. */
export function buildSignals(seeds: Seed[], loved: Seed[], max = MAX_SIGNALS): Seed[] {
  const seedIds = new Set(seeds.map((s) => s.id));
  const lovedNew = uniqueById(loved).filter((l) => !seedIds.has(l.id));
  const keep = Math.min(seeds.length, MIN_KEPT_SEEDS);
  const lovedTaken = lovedNew.slice(0, Math.max(0, max - keep));
  return [...lovedTaken, ...seeds.slice(0, max - lovedTaken.length)];
}

/** Upset items are excluded for good; anything currently used as a signal never is. */
export function buildExclusions(upsetIds: string[], signalIds: string[] = []): string[] {
  const signals = new Set(signalIds);
  return [...new Set(upsetIds)].filter((id) => !signals.has(id));
}

interface RatedSession {
  items: Item[];
  ratings: Record<string, Rating>;
}

/** Newest rating wins per item, so changing your mind later is respected. */
export function collectFeedback(sessions: RatedSession[]): Feedback {
  const decided = new Map<string, Rating>();
  const loved: Seed[] = [];
  for (const s of [...sessions].reverse()) {
    for (const item of s.items) {
      const r = s.ratings[item.id];
      if (!r || decided.has(item.id)) continue;
      decided.set(item.id, r);
      if (r === 'loved' && item.domain !== 'place') loved.push({ id: item.id, name: item.name, domain: item.domain });
    }
  }
  const upsetIds = [...decided].filter(([, r]) => r === 'upset').map(([id]) => id);
  return { loved, upsetIds };
}

export function diffSessions(prev: Item[], next: Item[], upsetIds: string[], lovedNames: string[]): Changes {
  const prevIds = new Set(prev.map((i) => i.id));
  const nextIds = new Set(next.map((i) => i.id));
  const lovedLower = new Set(lovedNames.map((n) => n.toLowerCase()));
  const upset = new Set(upsetIds);
  const added = next.filter((i) => !prevIds.has(i.id));
  const removed = prev.filter((i) => !nextIds.has(i.id));
  const drivers: Record<string, string[]> = {};
  for (const item of added) {
    const hit = (item.reasons ?? []).filter((r) => lovedLower.has(r.toLowerCase()));
    if (hit.length) drivers[item.id] = hit;
  }
  return { added, removed, upsetRemoved: removed.filter((i) => upset.has(i.id)), drivers };
}
