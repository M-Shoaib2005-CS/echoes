import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ItemDomain } from '../../../shared/types';

export interface RecordedEntry {
  kind: 'search' | 'insights';
  query?: string;
  domain?: string;
  params?: { domain: ItemDomain; signalIds: string[]; excludeIds: string[]; city?: string };
  response: unknown;
}
export interface RecordedFile {
  recordedAt: string;
  entries: RecordedEntry[];
}

export const RECORDED_PATH = join(process.cwd(), 'fixtures', 'recorded', 'recorded.json');

export function loadRecorded(path: string = RECORDED_PATH): RecordedFile | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const f = parsed as Partial<RecordedFile>;
    return typeof f.recordedAt === 'string' && Array.isArray(f.entries) && f.entries.length ? (f as RecordedFile) : null;
  } catch {
    return null;
  }
}

const jaccard = (a: string[], b: string[]): number => {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 1 : inter / union;
};

/** Closest recorded insights call for the same domain and city. Exclusions are re-applied in code later. */
export function findInsights(
  file: RecordedFile,
  p: { domain: ItemDomain; signalIds: string[]; city?: string },
): RecordedEntry | null {
  let best: RecordedEntry | null = null;
  let bestScore = 0.5; // below this overlap a replay would be misleading
  for (const e of file.entries) {
    if (e.kind !== 'insights' || !e.params || e.params.domain !== p.domain) continue;
    if (p.domain === 'place' && (e.params.city ?? '').toLowerCase() !== (p.city ?? '').toLowerCase()) continue;
    const score = jaccard(e.params.signalIds, p.signalIds);
    if (score >= bestScore) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}
