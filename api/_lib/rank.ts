import { normName } from '../../shared/text';
import type { Domain, Item, YearFilter } from '../../shared/types';
import { DOMAINS } from '../../shared/types';

export const PER_DOMAIN = 5;
export const MAX_TOTAL = 15;

const nameKey = (i: Item) => `${i.domain}|${normName(i.name)}`;
const aff = (i: Item) => i.affinity ?? -1;

/** Drops duplicates by id and by title, keeping the higher-affinity copy. */
export function dedupe(items: Item[]): Item[] {
  const best = new Map<string, Item>();
  for (const i of items) {
    const k = nameKey(i);
    const cur = best.get(k);
    if (!cur || aff(i) > aff(cur)) best.set(k, i);
  }
  const ids = new Set<string>();
  return [...best.values()].filter((i) => (ids.has(i.id) ? false : (ids.add(i.id), true)));
}

/** Compact item for the LLM and the client: only what is shown or reasoned over. */
export function trimItem(i: Item): Item {
  const out: Item = { id: i.id, name: i.name, domain: i.domain };
  if (i.affinity !== undefined) out.affinity = Math.round(i.affinity * 100) / 100;
  if (i.tags?.length) out.tags = i.tags.slice(0, 4);
  if (i.year !== undefined) out.year = i.year;
  if (i.imageUrl) out.imageUrl = i.imageUrl;
  if (i.reasons?.length) out.reasons = i.reasons.slice(0, 3);
  return out;
}

/** Release years from ages ~10 to 30, when the "reminiscence bump" makes memories strongest. The decade is approximate, so the window stays generous. */
export const eraWindow = (decade: number): [number, number] => [decade + 10, decade + 30];

export function applyYearFilter(items: Item[], bornDecade: number | undefined): { items: Item[]; filter: YearFilter } {
  if (bornDecade === undefined) return { items, filter: { active: false, note: '' } };
  const dated = items.filter((i) => i.year !== undefined);
  if (items.length === 0 || dated.length / items.length < 0.5) {
    return {
      items,
      filter: {
        active: false,
        note: "Born-around decade only shaped the plan wording. Release years aren't available in this data, so nothing was filtered.",
      },
    };
  }
  const [from, to] = eraWindow(bornDecade);
  const kept = items.filter((i) => i.year === undefined || (i.year >= from && i.year <= to));
  if (kept.length < 3) {
    return { items, filter: { active: false, note: 'Too few titles matched the era, so the era filter was relaxed.' } };
  }
  return { items: kept, filter: { active: true, note: `Films and TV were limited to ${from}–${to}, roughly ages 10 to 30, when memories are strongest. Music is not filtered by year.` } };
}

export function selectSession(
  byDomain: Partial<Record<Domain, Item[]>>,
  o: { excludeIds: Set<string>; excludeNames: Set<string>; bornDecade?: number; perDomain?: number; maxTotal?: number },
): { shown: Item[]; full: Item[]; yearFilter: YearFilter } {
  const per = o.perDomain ?? PER_DOMAIN;
  const shown: Item[] = [];
  const full: Item[] = [];
  const notes: YearFilter[] = [];
  for (const d of DOMAINS) {
    const ranked = dedupe(byDomain[d] ?? [])
      .filter((i) => !o.excludeIds.has(i.id) && !o.excludeNames.has(normName(i.name)))
      .sort((a, b) => aff(b) - aff(a)); // stable: Qloo's own order is kept when affinity is missing
    full.push(...ranked);
    if (d === 'artist') {
      shown.push(...ranked.slice(0, per));
    } else {
      const { items, filter } = applyYearFilter(ranked, o.bornDecade);
      notes.push(filter);
      shown.push(...items.slice(0, per));
    }
  }
  const capped = shown.slice(0, o.maxTotal ?? MAX_TOTAL).map(trimItem);
  const active = notes.some((n) => n.active);
  const yearFilter = active ? notes.find((n) => n.active)! : (notes.find((n) => n.note) ?? { active: false, note: '' });
  return { shown: capped, full, yearFilter };
}

/** Exact title matches first, collaboration entries ("A, B" / "A and B") after clean artist matches. */
export function rankSearchResults(items: Item[], query: string): Item[] {
  const q = normName(query);
  const score = (i: Item): number => {
    const n = normName(i.name);
    const base = n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3;
    const collab = i.domain === 'artist' && /, | (and|with|feat|vs)\.? /i.test(i.name) ? 0.5 : 0;
    return base + collab;
  };
  return items
    .map((item, index) => ({ item, index, s: score(item) }))
    .sort((a, b) => a.s - b.s || (b.item.popularity ?? 0) - (a.item.popularity ?? 0) || a.index - b.index)
    .map((x) => x.item);
}
