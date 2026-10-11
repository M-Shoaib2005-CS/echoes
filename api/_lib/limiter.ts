const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Spaces call starts at least 1/perSecond apart (about 4 req/s outbound to Qloo). */
export class RateLimiter {
  private next = 0;
  private interval: number;
  constructor(
    perSecond: number,
    private now: () => number = Date.now,
    private sleep: (ms: number) => Promise<void> = defaultSleep,
  ) {
    this.interval = 1000 / perSecond;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const t = this.now();
    const slot = Math.max(t, this.next);
    this.next = slot + this.interval;
    if (slot > t) await this.sleep(slot - t);
    return fn();
  }
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  o: { tries: number; baseMs: number; shouldRetry: (e: unknown) => boolean; sleep?: (ms: number) => Promise<void> },
): Promise<T> {
  const sleep = o.sleep ?? defaultSleep;
  let last: unknown;
  for (let attempt = 1; attempt <= o.tries; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      last = e;
      if (attempt >= o.tries || !o.shouldRetry(e)) throw e;
      await sleep(o.baseMs * attempt);
    }
  }
  throw last;
}

/** Sliding-window per-IP cap. Per-instance only; a determined abuser can outrun it. */
export class IpCap {
  private hits = new Map<string, number[]>();
  constructor(
    private limit: number,
    private windowMs: number,
    private now: () => number = Date.now,
  ) {}

  allow(ip: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(ip) ?? []).filter((x) => t - x < this.windowMs);
    const ok = recent.length < this.limit;
    if (ok) recent.push(t);
    this.hits.set(ip, recent);
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (v.every((x) => t - x >= this.windowMs)) this.hits.delete(k);
    }
    return ok;
  }
}

export class CallBudget {
  used = 0;
  constructor(readonly limit: number) {}
  spend(): boolean {
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }
}

const positiveInt = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
export const outboundLimiter = new RateLimiter(4);
export const callBudget = new CallBudget(positiveInt(process.env.QLOO_MONTHLY_BUDGET, 8000));
export { positiveInt };
