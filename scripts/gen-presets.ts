// Generates src/data/presets.generated.json: bundled sessions that load with zero API calls.
// Provenance follows QLOO_MODE: mock => "Sample data", recorded/live => labelled accordingly.
import { writeFileSync } from 'node:fs';
import { computeCompare } from '../shared/compare';
import type { CompareResult, PresetBundle } from '../shared/types';
import { PERSONAS } from '../shared/personas';
import { createLlm } from '../api/_lib/llm';
import { catalogueCheck, fetchCandidates, runCompare, runSession } from '../api/_lib/pipeline';
import { createQlooSource, sourceOptionsFromEnv } from '../api/_lib/qloo/source';
import { loadDotEnv } from './env';
import { resolveSeeds } from './resolve';
import { SAMPLE_LLM_ONLY } from './sample-llm-only';

async function main() {
  // `npm run presets -- recorded` works the same on Windows, macOS and Linux; it wins over .env files.
  const mode = process.argv[2];
  if (mode === 'recorded' || mode === 'live' || mode === 'mock') process.env.QLOO_MODE = mode;
  loadDotEnv();
  const qloo = createQlooSource(sourceOptionsFromEnv(process.env));
  const llm = createLlm(process.env);
  console.log(`Generating presets: qloo=${qloo.mode}, llm=${llm?.name ?? 'none (template plans, sample compare)'}`);
  const bundles: PresetBundle[] = [];
  for (const p of PERSONAS) {
    const seeds = await resolveSeeds(qloo, p.seeds);
    const req = { nickname: p.nickname, city: p.city, bornDecade: p.bornDecade, seeds };
    const response = await runSession(req, { qloo, llm });
    let compare: CompareResult | null = null;
    try {
      if (llm) {
        compare = await runCompare(req, { qloo, llm });
      } else {
        const c = await fetchCandidates(req, qloo);
        const llmItems = SAMPLE_LLM_ONLY[p.id] ?? [];
        const catalogue = await catalogueCheck(qloo, llmItems, { shown: c.shown, full: c.full, seeds });
        compare = computeCompare({ llmItems, seeds, shown: c.shown, full: c.full, source: c.source, llmSource: 'sample', catalogue });
      }
    } catch (e) {
      console.warn(`Compare skipped for ${p.id}:`, e instanceof Error ? e.message : e);
    }
    bundles.push({
      id: p.id, title: p.title, blurb: p.blurb, nickname: p.nickname, city: p.city, bornDecade: p.bornDecade,
      seeds, response, compare, idSpace: qloo.idSpace, generatedAt: new Date().toISOString(),
    });
    console.log(`  ${p.id}: ${response.items.length} items, plan=${response.planSource}`);
  }
  writeFileSync('src/data/presets.generated.json', JSON.stringify(bundles, null, 1));
  console.log('Wrote src/data/presets.generated.json');
}
void main();
