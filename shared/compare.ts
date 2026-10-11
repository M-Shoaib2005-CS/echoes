import { normName } from './text';
import type {
  CompareResult,
  CompareRow,
  CompareVerdict,
  DataSource,
  Item,
  LlmOnlyItem,
  Seed,
} from './types';

export const compareKey = (domain: string, name: string) => `${domain}|${normName(name)}`;
const key = compareKey;

/** Honest, computable differences between the Qloo list and a Qloo-free LLM list. */
export function computeCompare(args: {
  llmItems: LlmOnlyItem[];
  seeds: Seed[];
  shown: Item[];
  full: Item[];
  llmSource: 'llm' | 'sample';
  source: DataSource;
  /** Result of searching Qloo for titles that were not among its picks. Omitted = no check was made. */
  catalogue?: { found: Set<string>; unchecked: Set<string> };
}): CompareResult {
  const seedKeys = new Set(args.seeds.map((s) => key(s.domain, s.name)));
  const shownKeys = new Set(args.shown.map((i) => key(i.domain, i.name)));
  const fullKeys = new Set(args.full.map((i) => key(i.domain, i.name)));

  const rows: CompareRow[] = args.llmItems.map((it) => {
    const k = key(it.domain, it.name);
    const status = seedKeys.has(k)
      ? 'seed'
      : shownKeys.has(k)
        ? 'in-shown'
        : fullKeys.has(k)
          ? 'in-qloo'
          : args.catalogue?.found.has(k)
            ? 'in-catalogue'
            : args.catalogue?.unchecked.has(k)
              ? 'unchecked'
              : 'not-found';
    return { ...it, status };
  });
  const counted = rows.filter((r) => r.status !== 'seed');
  const overlapShown = counted.filter((r) => r.status === 'in-shown').length;
  const inQlooResults = counted.filter((r) => r.status === 'in-shown' || r.status === 'in-qloo').length;
  const inCatalogue = counted.filter((r) => r.status === 'in-catalogue').length;
  const unchecked = counted.filter((r) => r.status === 'unchecked').length;
  const notFound = counted.filter((r) => r.status === 'not-found').length;
  const llmKeys = new Set(args.llmItems.map((i) => key(i.domain, i.name)));
  const qlooOnly = args.shown.filter((i) => !llmKeys.has(key(i.domain, i.name)));
  const qlooWithReasons = args.shown.filter((i) => (i.reasons?.length ?? 0) > 0).length;
  const stats = {
    llmTotal: counted.length,
    inQlooResults,
    overlapShown,
    notFound,
    inCatalogue,
    unchecked,
    qlooShown: args.shown.length,
    qlooUnique: qlooOnly.length,
    qlooWithReasons,
  };

  const denom = Math.max(1, Math.min(stats.llmTotal, stats.qlooShown));
  const ratio = overlapShown / denom;
  const verdict: CompareVerdict = ratio >= 0.6 ? 'similar' : ratio <= 0.2 ? 'different' : 'mixed';

  const parts = [
    `Of ${stats.llmTotal} titles the AI suggested on its own, ${inQlooResults} appear in Qloo's results for these favourites (${overlapShown} of them among the picks shown).`,
  ];
  if (inCatalogue) parts.push(`${inCatalogue} exist in Qloo's catalogue but were not recommended for these favourites.`);
  if (notFound) parts.push(`${notFound} could not be found in Qloo at all.`);
  if (unchecked) parts.push(`${unchecked} were not checked against Qloo's catalogue in this data.`);
  parts.push(`Qloo's picks include ${stats.qlooUnique} titles the AI did not mention.`);
  parts.push(
    stats.qlooWithReasons > 0
      ? `${stats.qlooWithReasons} of Qloo's picks carry a "because of" reason; the AI-only list carries none.`
      : `No "because of" reasons were available for Qloo's picks in this data; the AI-only list carries none either.`,
  );
  if (verdict === 'similar') parts.push('For these favourites the two lists are quite similar.');
  return { rows, llmSource: args.llmSource, stats, qlooOnly, verdict, summary: parts.join(' '), source: args.source };
}
