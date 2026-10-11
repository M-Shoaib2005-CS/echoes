import { normName } from '../shared/text';
import type { Seed } from '../shared/types';
import type { QlooSource } from '../api/_lib/qloo/source';

/** Turns persona favourites into entity ids using whichever data source is active. */
export async function resolveSeeds(qloo: QlooSource, seeds: { name: string; domain: Seed['domain'] }[]): Promise<Seed[]> {
  const out: Seed[] = [];
  for (const s of seeds) {
    const { items } = await qloo.search(s.name, s.domain);
    const hit = items.find((i) => i.domain === s.domain && normName(i.name) === normName(s.name)) ?? items.find((i) => i.domain === s.domain);
    if (!hit) throw new Error(`Could not resolve "${s.name}" (${s.domain})`);
    out.push({ id: hit.id, name: s.name, domain: s.domain });
  }
  return out;
}
