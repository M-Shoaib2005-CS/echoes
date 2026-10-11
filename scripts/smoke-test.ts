// Run with QLOO_API_KEY set: npm run smoke. Saves raw JSON to fixtures/raw/ and reports which fields exist.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_BASE_URL, insightsRaw, qlooGet, QlooError, searchRaw, tagsRaw, type QlooConfig } from '../api/_lib/qloo/client';
import { normalizeInsights, normalizeSearch, normalizeTagInfos, normalizeTags } from '../api/_lib/qloo/normalize';
import type { Domain, Item } from '../shared/types';
import { loadDotEnv } from './env';

loadDotEnv();
const apiKey = process.env.QLOO_API_KEY;
if (!apiKey) {
  console.error('Set QLOO_API_KEY (in .env.local or the shell) and run again.');
  process.exit(1);
}
const cfg: QlooConfig = { apiKey, baseUrl: process.env.QLOO_BASE_URL || DEFAULT_BASE_URL };
mkdirSync('fixtures/raw', { recursive: true });

interface Row {
  call: string;
  status: string;
  count: number | string;
  fields: string;
  firstKeys: string;
}
const rows: Row[] = [];
let n = 0;

function firstEntityKeys(raw: unknown): string {
  const r = raw as { results?: unknown };
  const list = Array.isArray(r?.results) ? r.results : (r?.results as { entities?: unknown } | undefined)?.entities;
  const first: unknown = Array.isArray(list) ? list[0] : undefined;
  return first && typeof first === 'object' ? Object.keys(first).join(',') : '(no entity)';
}

function fieldReport(items: Item[]): string {
  const c = (f: (i: Item) => boolean) => `${items.filter(f).length}/${items.length}`;
  const years = items.flatMap((i) => (i.year !== undefined ? [i.year] : []));
  const range = years.length ? ` (${Math.min(...years)}-${Math.max(...years)})` : '';
  return `affinity ${c((i) => i.affinity !== undefined)}, year ${c((i) => i.year !== undefined)}${range}, image ${c((i) => !!i.imageUrl)}, tags ${c((i) => !!i.tags?.length)}, explain ${c((i) => !!i.reasons?.length)}`;
}

async function step(call: string, run: () => Promise<unknown>, summarize: (raw: unknown) => { count: number | string; fields: string }) {
  n++;
  try {
    const raw = await run();
    writeFileSync(`fixtures/raw/${String(n).padStart(2, '0')}-${call.replace(/\W+/g, '-')}.json`, JSON.stringify(raw, null, 2));
    const s = summarize(raw);
    rows.push({ call, status: 'ok', count: s.count, fields: s.fields, firstKeys: firstEntityKeys(raw) });
    return raw;
  } catch (e) {
    rows.push({ call, status: e instanceof QlooError ? `ERROR ${e.status ?? e.kind}` : 'ERROR', count: 0, fields: '-', firstKeys: '-' });
    return null;
  }
}

async function main() {
  const ids: Record<Domain, string[]> = { artist: [], movie: [], tv_show: [] };
  const nameById: Record<string, string> = {};
  const searches: [Domain, string][] = [['artist', 'Frank Sinatra'], ['artist', 'Lata Mangeshkar'], ['movie', 'Casablanca'], ['tv_show', 'I Love Lucy']];
  for (const [domain, q] of searches) {
    const raw = await step(`search ${domain} ${q}`, () => searchRaw(q, domain, 5, cfg), (r) => {
      const items = normalizeSearch(r, { fallbackDomain: domain });
      return { count: items.length, fields: fieldReport(items) };
    });
    const first = raw ? normalizeSearch(raw, { fallbackDomain: domain })[0] : undefined;
    if (first) {
      ids[domain].push(first.id);
      nameById[first.id] = first.name;
    }
  }
  const signalIds = [...ids.artist, ...ids.movie, ...ids.tv_show];
  for (const domain of ['artist', 'movie', 'tv_show'] as const) {
    await step(`insights ${domain}`, () => insightsRaw({ domain, signalIds, excludeIds: [], take: 10, nameById }, cfg), (r) => {
      const items = normalizeInsights(r, { fallbackDomain: domain, nameById });
      return { count: items.length, fields: fieldReport(items) };
    });
  }
  await step('search all Casablanca', () => searchRaw('Casablanca', undefined, 5, cfg), (r) => {
    const items = normalizeSearch(r);
    return { count: items.length, fields: fieldReport(items) };
  });
  await step('insights movie era 1948-1975', () => insightsRaw({ domain: 'movie', signalIds, excludeIds: [], take: 10, nameById, yearMin: 1948, yearMax: 1975 }, cfg), (r) => {
    const items = normalizeInsights(r, { fallbackDomain: 'movie', nameById });
    return { count: items.length, fields: fieldReport(items) };
  });
  await step('insights place London with signals', () => insightsRaw({ domain: 'place', signalIds, excludeIds: [], take: 5, city: 'London', nameById }, cfg), (r) => {
    const items = normalizeInsights(r, { fallbackDomain: 'place', nameById });
    return { count: items.length, fields: fieldReport(items) };
  });
  await step('insights place London', () => insightsRaw({ domain: 'place', signalIds: [], excludeIds: [], take: 5, city: 'London' }, cfg), (r) => {
    const items = normalizeInsights(r, { fallbackDomain: 'place', nameById });
    return { count: items.length, fields: fieldReport(items) };
  });
  await step('tags jazz', () => tagsRaw('jazz', cfg), (r) => ({ count: normalizeTags(r).length, fields: 'tag names' }));
  // Agent experiments: do tag ids work as a soft signal and as a hard filter? (parameter names are unconfirmed)
  const ghazal = await step('tags ghazal', () => tagsRaw('ghazal', cfg), (r) => {
    const t = normalizeTagInfos(r);
    return { count: t.length, fields: t.slice(0, 3).map((x) => `${x.name} [${x.id}]`).join('; ') };
  });
  const tagId = ghazal ? normalizeTagInfos(ghazal)[0]?.id : undefined;
  if (tagId) {
    const names = (items: Item[]) => items.slice(0, 4).map((i) => i.name).join(', ');
    await step('insights artist signal.interests.tags only', () => insightsRaw({ domain: 'artist', signalIds: [], excludeIds: [], take: 10, nameById, signalTagIds: [tagId] }, cfg), (r) => {
      const items = normalizeInsights(r, { fallbackDomain: 'artist', nameById });
      return { count: items.length, fields: `${fieldReport(items)} | ${names(items)}` };
    });
    await step('insights artist signal.interests.tags with favourites', () => insightsRaw({ domain: 'artist', signalIds, excludeIds: [], take: 10, nameById, signalTagIds: [tagId] }, cfg), (r) => {
      const items = normalizeInsights(r, { fallbackDomain: 'artist', nameById });
      return { count: items.length, fields: `${fieldReport(items)} | ${names(items)}` };
    });
    await step('insights artist filter.tags with favourites', () => insightsRaw({ domain: 'artist', signalIds, excludeIds: [], take: 10, nameById, tagIds: [tagId] }, cfg), (r) => {
      const items = normalizeInsights(r, { fallbackDomain: 'artist', nameById });
      return { count: items.length, fields: `${fieldReport(items)} | ${names(items)}` };
    });
  }
  void qlooGet; // exported for ad-hoc experiments

  console.log('\nQloo smoke test report\n');
  for (const r of rows) console.log(`${r.status.padEnd(10)} ${r.call}\n           results: ${r.count} | ${r.fields}\n           first entity keys: ${r.firstKeys}`);
  const failures = rows.filter((r) => r.status !== 'ok').length;
  console.log(`\n${rows.length - failures}/${rows.length} calls succeeded. Raw JSON saved in fixtures/raw/.`);
  console.log('Next: paste a few of those files to Claude so normalize.ts can be adjusted. See scripts/POST_KEY_CHECKLIST.md.');
}
void main();
