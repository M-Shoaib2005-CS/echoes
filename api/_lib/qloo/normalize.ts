// ALL mapping from Qloo response fields to the internal Item type lives in this file.
// Every field is optional and nothing here throws: unexpected shapes are logged and degraded.
// When real JSON arrives (npm run smoke), fix mismatches here and nowhere else.
import { dig } from '../../../shared/text';
import type { Item, ItemDomain, TagInfo } from '../../../shared/types';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const asStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const asNum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const asHttp = (v: unknown): string | undefined => {
  const s = asStr(v);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};
export const warn = (msg: string): void => console.warn(`[qloo/normalize] ${msg}`);

const URN_PREFIX = 'urn:entity:';
const KNOWN: ItemDomain[] = ['artist', 'movie', 'tv_show', 'place'];
/** TODO(verify): exact URN spellings, especially urn:entity:movie and urn:entity:tv_show. */
export const typeUrn = (d: ItemDomain): string => `${URN_PREFIX}${d}`;
export function domainFromUrn(v: unknown): ItemDomain | undefined {
  const s = asStr(v);
  if (!s?.startsWith(URN_PREFIX)) return undefined;
  return KNOWN.find((d) => d === s.slice(URN_PREFIX.length));
}

function parseYear(v: unknown): number | undefined {
  const n = asNum(v) ?? (asStr(v) ? Number(/\d{4}/.exec(String(v))?.[0]) : undefined);
  return n !== undefined && Number.isInteger(n) && n >= 1800 && n <= 2100 ? n : undefined;
}


/** Genre and theme tags read well on a card; audience, instrument and media-keyword tags do not. */
function tagRank(type: string | undefined): number | null {
  if (!type) return 2;
  if (/:(audience|instrument|influence|influenced_by)(:|$)|:keyword:media/.test(type)) return null;
  if (/:(genre|subgenre|genre_category)(:|$)/.test(type)) return 0;
  if (/:(theme|plot|mood|emotional_tone|style)(:|$)/.test(type)) return 1;
  return 2;
}
function rankTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ranked = raw
    .map((t) => ({ name: (asStr(t) ?? (isRec(t) ? asStr(t.name) : undefined)), rank: isRec(t) ? tagRank(asStr(t.type)) : 2 }))
    .flatMap((t) => (t.name && t.rank !== null ? [{ name: t.name, rank: t.rank }] : []))
    .sort((a, b) => a.rank - b.rank); // stable
  const seen = new Set<string>();
  return ranked.filter((t) => (seen.has(t.name.toLowerCase()) ? false : (seen.add(t.name.toLowerCase()), true))).map((t) => t.name).slice(0, 6);
}

export interface NormalizeCtx {
  fallbackDomain?: ItemDomain;
  /** Signal entity id -> name, used to turn explainability into readable "because of" names. */
  nameById?: Record<string, string>;
}

/**
 * Reasons are only ever names of signal entities we sent, so a made-up reason cannot appear.
 * The confirmed shape is handled first; other shapes fall back to a generic scan.
 */
export function extractReasons(raw: Rec, nameById?: Record<string, string>): string[] {
  if (!nameById) return [];
  // Confirmed shape: query.explainability["signal.interests.entities"] = [{ entity_id, score }]
  const signals = dig(raw, 'query', 'explainability', 'signal.interests.entities');
  if (Array.isArray(signals)) {
    const byId = new Map(Object.entries(nameById).map(([id, name]) => [id.toLowerCase(), name]));
    const scored = signals
      .map((x) => ({ id: asStr(dig(x, 'entity_id')), score: asNum(dig(x, 'score')) ?? 0 }))
      .flatMap((x) => (x.id && byId.has(x.id.toLowerCase()) ? [{ name: byId.get(x.id.toLowerCase())!, score: x.score }] : []));
    return scored.sort((a, b) => b.score - a.score).slice(0, 2).map((x) => x.name);
  }
  const src = raw.explainability ?? dig(raw, 'query', 'explainability');
  if (src === undefined) return [];
  const byLowerName = new Map(Object.values(nameById).map((n) => [n.toLowerCase(), n]));
  const out = new Set<string>();
  const visit = (v: unknown, depth: number): void => {
    if (depth > 5) return;
    if (typeof v === 'string') {
      const hit = nameById[v] ?? byLowerName.get(v.toLowerCase());
      if (hit) out.add(hit);
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, depth + 1));
    else if (isRec(v)) Object.values(v).forEach((x) => visit(x, depth + 1));
  };
  visit(src, 0);
  return [...out].slice(0, 3);
}

export function normalizeEntity(raw: unknown, ctx: NormalizeCtx = {}): Item | null {
  if (!isRec(raw)) return null;
  const id = asStr(raw.entity_id) ?? asStr(raw.id);
  const name = asStr(raw.name);
  if (!id || !name) {
    warn('skipped an entity without id or name');
    return null;
  }
  // Search results use `types: [urn]`; insights use `type: 'urn:entity'` plus `subtype: urn:entity:<domain>`.
  const typeCandidates = [raw.subtype, raw.type, ...(Array.isArray(raw.types) ? raw.types : [])];
  const domain = typeCandidates.map(domainFromUrn).find((d) => d !== undefined) ?? ctx.fallbackDomain;
  if (!domain) {
    warn(`skipped "${name}": unknown entity type`);
    return null;
  }
  const item: Item = { id, name, domain };

  // Confirmed: query.affinity in 0..1 (absent for places). Accepted only if within 0..1.
  const affinity = asNum(dig(raw, 'query', 'affinity')) ?? asNum(raw.affinity) ?? asNum(raw.score);
  if (affinity !== undefined && affinity >= 0 && affinity <= 1) item.affinity = affinity;

  const popularity = asNum(raw.popularity);
  if (popularity !== undefined) item.popularity = popularity;

  const tags = rankTags(raw.tags);
  if (tags.length) item.tags = tags;

  // Confirmed: properties.release_year for films and TV (absent for artists and places).
  const year = [dig(raw, 'properties', 'release_year'), raw.release_year, dig(raw, 'properties', 'year'), dig(raw, 'properties', 'release_date'), raw.release_date]
    .map(parseYear)
    .find((y) => y !== undefined);
  if (year !== undefined) item.year = year;

  // Confirmed: properties.image.url; places use properties.images[0].url.
  const img = [dig(raw, 'properties', 'image', 'url'), dig(raw, 'properties', 'images', 0, 'url'), dig(raw, 'properties', 'image'), dig(raw, 'image', 'url'), raw.image, raw.image_url, raw.thumbnail]
    .map(asHttp)
    .find((u) => u !== undefined);
  if (img) item.imageUrl = img;

  const reasons = extractReasons(raw, ctx.nameById);
  if (reasons.length) item.reasons = reasons;
  return item;
}

/** Confirmed: /search returns results as an array; /v2/insights returns results.entities. Both are tried. */
function entityList(raw: unknown): unknown[] {
  for (const candidate of [dig(raw, 'results', 'entities'), dig(raw, 'results'), dig(raw, 'entities')]) {
    if (Array.isArray(candidate)) return candidate;
  }
  warn('unexpected response shape: no entity list found');
  return [];
}

export function normalizeInsights(raw: unknown, ctx: NormalizeCtx = {}): Item[] {
  return entityList(raw)
    .map((e) => normalizeEntity(e, ctx))
    .filter((i): i is Item => i !== null);
}
export const normalizeSearch = normalizeInsights;

/** Confirmed: /v2/tags returns results.tags[] with id, name, type. Only the smoke test inspects it. */
export function normalizeTags(raw: unknown): string[] {
  const list = [dig(raw, 'results', 'tags'), dig(raw, 'results'), dig(raw, 'tags')].find(Array.isArray);
  if (!list) {
    warn('unexpected tags response shape');
    return [];
  }
  return list
    .map((t: unknown) => asStr(t) ?? (isRec(t) ? asStr(t.name) : undefined))
    .filter((t: string | undefined): t is string => t !== undefined);
}

/** Tags with their ids, which the agent needs to pass back to Qloo. Names are trimmed (Qloo returns " Jazz"). */
export function normalizeTagInfos(raw: unknown): TagInfo[] {
  const list = [dig(raw, 'results', 'tags'), dig(raw, 'results'), dig(raw, 'tags')].find(Array.isArray);
  if (!list) {
    warn('unexpected tags response shape');
    return [];
  }
  return list.flatMap((t: unknown): TagInfo[] => {
    if (!isRec(t)) return [];
    const id = asStr(t.id) ?? asStr(t.tag_id);
    const name = asStr(t.name);
    const type = asStr(t.type);
    return id && name ? [{ id, name, ...(type ? { type } : {}) }] : [];
  });
}
