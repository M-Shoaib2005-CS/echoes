// npm run record: runs the preset personas end to end against LIVE Qloo and saves the raw responses
// to fixtures/recorded/recorded.json for replay when live calls fail or quota runs out.
import { mkdirSync, writeFileSync } from 'node:fs';
import { PERSONAS } from '../shared/personas';
import { runSession } from '../api/_lib/pipeline';
import { createQlooSource, sourceOptionsFromEnv } from '../api/_lib/qloo/source';
import type { RecordedEntry } from '../api/_lib/qloo/recorded';
import { loadDotEnv } from './env';
import { resolveSeeds } from './resolve';

async function main() {
  loadDotEnv();
  const opts = sourceOptionsFromEnv({ ...process.env, QLOO_MODE: 'live' });
  if (!opts.apiKey) {
    console.error('Set QLOO_API_KEY before recording.');
    process.exit(1);
  }
  const entries: RecordedEntry[] = [];
  // recorded: null so a live failure is reported instead of silently replaying old data
  const qloo = createQlooSource({ ...opts, recorded: null, onRaw: (e) => entries.push(e) });
  for (const p of PERSONAS) {
    console.log(`Recording ${p.id}...`);
    const seeds = await resolveSeeds(qloo, p.seeds);
    const req = { nickname: p.nickname, city: p.city, bornDecade: p.bornDecade, seeds };
    const first = await runSession(req, { qloo, llm: null });
    // Second round simulates "Next session": first two items loved, third upset.
    const loved = first.items.slice(0, 2).flatMap((i) => (i.domain === 'place' ? [] : [{ id: i.id, name: i.name, domain: i.domain }]));
    const upsetIds = first.items.slice(2, 3).map((i) => i.id);
    await runSession({ ...req, feedback: { loved, upsetIds } }, { qloo, llm: null });
  }
  mkdirSync('fixtures/recorded', { recursive: true });
  writeFileSync('fixtures/recorded/recorded.json', JSON.stringify({ recordedAt: new Date().toISOString().slice(0, 10), entries }, null, 1));
  console.log(`Saved ${entries.length} responses to fixtures/recorded/recorded.json`);
  console.log('Now run: npm run presets:recorded   (rebuilds the bundled presets from this data)');
}
void main();
