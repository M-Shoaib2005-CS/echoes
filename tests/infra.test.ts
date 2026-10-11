import { describe, expect, it, vi } from 'vitest';
import { DedupedCache, requestKey, TtlLru } from '../api/_lib/cache';
import { CallBudget, IpCap, RateLimiter, withRetry } from '../api/_lib/limiter';
import { qlooGet, QlooError, insightsQuery } from '../api/_lib/qloo/client';

describe('TtlLru', () => {
  it('expires entries and evicts the least recently used', () => {
    let now = 0;
    const c = new TtlLru<number>(2, 100, () => now);
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // a is now most recent
    c.set('c', 3); // evicts b
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    now = 101;
    expect(c.get('a')).toBeUndefined();
  });
});

describe('DedupedCache', () => {
  it('shares one in-flight computation and caches the result', async () => {
    const cache = new DedupedCache<number>(new TtlLru(10, 1000));
    const fn = vi.fn(async () => 42);
    const [x, y] = await Promise.all([cache.getOrCompute('k', fn), cache.getOrCompute('k', fn)]);
    await cache.getOrCompute('k', fn);
    expect([x, y]).toEqual([42, 42]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('does not cache failures', async () => {
    const cache = new DedupedCache<number>(new TtlLru(10, 1000));
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(1);
    await expect(cache.getOrCompute('k', fn)).rejects.toThrow();
    expect(await cache.getOrCompute('k', fn)).toBe(1);
  });
});

describe('requestKey', () => {
  it('ignores case, whitespace, key order and string-array order', () => {
    expect(requestKey({ a: [' B', 'a'], c: 'X' })).toBe(requestKey({ c: 'x ', a: ['A', 'b'] }));
    expect(requestKey({ a: 1 })).not.toBe(requestKey({ a: 2 }));
  });
});

describe('RateLimiter, IpCap, CallBudget', () => {
  it('spaces calls 250ms apart at 4 per second', async () => {
    const waits: number[] = [];
    const lim = new RateLimiter(4, () => 0, async (ms) => void waits.push(ms));
    await Promise.all([lim.schedule(async () => 1), lim.schedule(async () => 2), lim.schedule(async () => 3)]);
    expect(waits).toEqual([250, 500]);
  });
  it('caps requests per window per IP', () => {
    let now = 0;
    const cap = new IpCap(2, 1000, () => now);
    expect([cap.allow('1'), cap.allow('1'), cap.allow('1'), cap.allow('2')]).toEqual([true, true, false, true]);
    now = 1001;
    expect(cap.allow('1')).toBe(true);
  });
  it('stops spending at the budget', () => {
    const b = new CallBudget(2);
    expect([b.spend(), b.spend(), b.spend()]).toEqual([true, true, false]);
  });
});

describe('withRetry', () => {
  it('retries only when allowed and at most twice', async () => {
    const sleep = async () => {};
    const fn = vi.fn().mockRejectedValue(new Error('x'));
    await expect(withRetry(fn, { tries: 2, baseMs: 1, sleep, shouldRetry: () => true })).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(2);
    fn.mockClear();
    await expect(withRetry(fn, { tries: 2, baseMs: 1, sleep, shouldRetry: () => false })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('qlooGet', () => {
  const cfg = { apiKey: 'k', baseUrl: 'https://example.test' };
  const res = (status: number, body: unknown = {}) => ({ ok: status < 400, status, json: async () => body }) as Response;
  const fast = { limiter: new RateLimiter(1000), sleep: async () => {} };

  it('retries once on 429 then returns the body and sends the key header', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(429)).mockResolvedValueOnce(res(200, { success: true, ok: 1 }));
    const out = await qlooGet('/v2/insights', { a: 1 }, cfg, { fetchImpl, ...fast, budget: new CallBudget(10) });
    expect(out).toEqual({ success: true, ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ headers: { 'X-Api-Key': 'k' } });
  });
  it('does not retry a 404', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404));
    await expect(qlooGet('/x', {}, cfg, { fetchImpl, ...fast, budget: new CallBudget(10) })).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('refuses calls once the budget is spent', async () => {
    const fetchImpl = vi.fn();
    const err = await qlooGet('/x', {}, cfg, { fetchImpl, ...fast, budget: new CallBudget(0) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(QlooError);
    expect((err as QlooError).kind).toBe('budget');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('insightsQuery', () => {
  it('builds signal and exclusion parameters', () => {
    const q = insightsQuery({ domain: 'movie', signalIds: ['a', 'b'], excludeIds: ['x'], take: 20 });
    expect(q).toMatchObject({ 'filter.type': 'urn:entity:movie', 'signal.interests.entities': 'a,b', 'filter.exclude.entities': 'x', take: 20, 'feature.explainability': true });
    expect(insightsQuery({ domain: 'place', signalIds: [], excludeIds: [], take: 3, city: 'Lahore' })['filter.location.query']).toBe('Lahore');
  });
});
