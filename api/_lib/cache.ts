/** Small in-memory LRU with TTL. Serverless memory is per-instance and not durable. */
export class TtlLru<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(
    private max: number,
    private ttlMs: number,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    this.map.delete(key);
    if (e.exp <= this.now()) return undefined;
    this.map.set(key, e); // refresh recency
    return e.v;
  }

  set(key: string, v: V, ttlMs: number = this.ttlMs): void {
    this.map.delete(key);
    this.map.set(key, { v, exp: this.now() + ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }
}

/** Cache plus in-flight deduplication: concurrent identical requests share one computation. */
export class DedupedCache<V> {
  private inflight = new Map<string, Promise<V>>();
  constructor(private store: TtlLru<V>) {}

  async getOrCompute(key: string, fn: () => Promise<V>, ttlFor?: (v: V) => number | undefined): Promise<V> {
    const hit = this.store.get(key);
    if (hit !== undefined) return hit;
    const running = this.inflight.get(key);
    if (running) return running;
    const p = fn()
      .then((v) => {
        this.store.set(key, v, ttlFor?.(v));
        return v;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }
}

function canon(v: unknown): unknown {
  if (typeof v === 'string') return v.trim().toLowerCase();
  if (Array.isArray(v)) {
    const mapped = v.map(canon);
    return mapped.every((x) => typeof x === 'string') ? [...mapped].sort() : mapped;
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const c = canon((v as Record<string, unknown>)[k]);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return v;
}

/** Order- and case-insensitive request key, so equivalent requests share a cache entry. */
export const requestKey = (value: unknown): string => JSON.stringify(canon(value));
