import { dig, normName } from '../../shared/text';
import type { CompareResult, DataSource, Domain, HealthInfo, IdSpace, Item, Seed, SessionRequest, SessionResponse } from '../../shared/types';

export class ApiFail extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const GENERIC = 'Something went wrong. Please try again in a moment, or open a ready-made session.';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiFail("We couldn't reach the server. Check your connection and try again.", 'network');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = dig(body, 'error', 'message');
    const code = dig(body, 'error', 'code');
    throw new ApiFail(typeof msg === 'string' ? msg : GENERIC, typeof code === 'string' ? code : 'http');
  }
  return body as T;
}

/** sessionStorage cache so going back and forth never repeats a call. */
async function cached<T>(key: string, run: () => Promise<T>): Promise<T> {
  const k = `echoes:c:${key}`;
  try {
    const hit = sessionStorage.getItem(k);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    /* cache unavailable */
  }
  const value = await run();
  try {
    sessionStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* cache full */
  }
  return value;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const searchEntities = (q: string, domain?: Domain) =>
  cached(`s:${domain ?? 'all'}:${normName(q)}`, () =>
    call<{ items: Item[]; source: DataSource }>(`/api/search?q=${encodeURIComponent(q)}${domain ? `&domain=${domain}` : ''}`),
  );
export const createSession = (req: SessionRequest) => cached(`session:${JSON.stringify(req)}`, () => call<SessionResponse>('/api/session', post(req)));
/** Ask Echoes: the agent shapes a new session from a plain-language instruction. Not cached, since runs vary. */
export const createAgentSession = (req: SessionRequest, instruction: string) =>
  call<SessionResponse>('/api/agent', post({ ...req, instruction }));
export const createCompare = (req: SessionRequest) => cached(`compare:${JSON.stringify(req)}`, () => call<CompareResult>('/api/compare', post(req)));

let health: Promise<HealthInfo | null> | undefined;
export const getHealth = (): Promise<HealthInfo | null> => (health ??= call<HealthInfo>('/api/health').catch(() => null));

/** Bundled presets carry ids from the data they were built with; re-resolve by name if the server uses a different id space. */
export async function seedsForServer(seeds: Seed[], idSpace: IdSpace): Promise<{ seeds: Seed[]; idSpace: IdSpace }> {
  const h = await getHealth();
  if (!h || h.idSpace === idSpace) return { seeds, idSpace };
  const out: Seed[] = [];
  for (const s of seeds) {
    const { items } = await searchEntities(s.name, s.domain);
    const hit = items.find((i) => i.domain === s.domain && normName(i.name) === normName(s.name)) ?? items.find((i) => i.domain === s.domain);
    if (!hit) throw new ApiFail(`We couldn't match "${s.name}" in the current data. Remove it and add a similar favourite instead.`, 'unresolved');
    out.push({ id: hit.id, name: s.name, domain: s.domain });
  }
  return { seeds: out, idSpace: h.idSpace };
}
