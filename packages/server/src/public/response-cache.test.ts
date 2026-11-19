import { describe, expect, it } from 'vitest';
import { PUBLIC_CACHE_TTL_MS, createPublicResponseCache } from './response-cache.js';

function cacheWithClock() {
  const clock = { now: 1_000_000 };
  return { clock, cache: createPublicResponseCache(() => clock.now) };
}

describe('createPublicResponseCache', () => {
  it('serves a stored body until the TTL passes', () => {
    const { clock, cache } = cacheWithClock();
    cache.set('t1', 'view', cache.generation('t1'), { name: 'Liga testowa' });
    clock.now += PUBLIC_CACHE_TTL_MS - 1;
    expect(cache.get('t1', 'view')).toEqual({ name: 'Liga testowa' });
    clock.now += 1;
    expect(cache.get('t1', 'view')).toBeUndefined();
  });

  it('keeps endpoints and tournaments apart', () => {
    const { cache } = cacheWithClock();
    cache.set('t1', 'view', 0, 'view');
    cache.set('t1', 'match:m1', 0, 'm1');
    expect(cache.get('t1', 'stats')).toBeUndefined();
    expect(cache.get('t1', 'match:m2')).toBeUndefined();
    expect(cache.get('t2', 'view')).toBeUndefined();
    expect(cache.get('t1', 'match:m1')).toBe('m1');
  });

  it('drops every entry of a tournament on invalidate and keeps other tournaments', () => {
    const { cache } = cacheWithClock();
    cache.set('t1', 'view', 0, 'view');
    cache.set('t1', 'stats', 0, 'stats');
    cache.set('t2', 'view', 0, 'other');
    cache.invalidate('t1');
    expect(cache.get('t1', 'view')).toBeUndefined();
    expect(cache.get('t1', 'stats')).toBeUndefined();
    expect(cache.get('t2', 'view')).toBe('other');
  });

  it('does not store a read that took its generation before an invalidate', () => {
    const { cache } = cacheWithClock();
    const generation = cache.generation('t1');
    cache.invalidate('t1');
    cache.set('t1', 'view', generation, 'stale');
    expect(cache.get('t1', 'view')).toBeUndefined();
    expect(cache.entryCount()).toBe(0);
    cache.set('t1', 'view', cache.generation('t1'), 'fresh');
    expect(cache.get('t1', 'view')).toBe('fresh');
  });

  it('prunes expired entries on write', () => {
    const { clock, cache } = cacheWithClock();
    cache.set('t1', 'view', 0, 'view');
    cache.set('t2', 'view', 0, 'view');
    clock.now += PUBLIC_CACHE_TTL_MS;
    cache.set('t3', 'stats', 0, 'stats');
    expect(cache.entryCount()).toBe(1);
  });

  it('remembers a loaded body and loads again after the TTL', async () => {
    const { clock, cache } = cacheWithClock();
    let loads = 0;
    const load = () => Promise.resolve(++loads);
    expect(await cache.remember('t1', 'view', load)).toBe(1);
    expect(await cache.remember('t1', 'view', load)).toBe(1);
    clock.now += PUBLIC_CACHE_TTL_MS;
    expect(await cache.remember('t1', 'view', load)).toBe(2);
  });

  it('stores nothing when the load fails', async () => {
    const { cache } = cacheWithClock();
    await expect(cache.remember('t1', 'view', () => Promise.reject(new Error('404')))).rejects.toThrow('404');
    expect(cache.entryCount()).toBe(0);
  });

  it('does not store a load that an invalidate overtook', async () => {
    const { cache } = cacheWithClock();
    const body = await cache.remember('t1', 'view', () => {
      cache.invalidate('t1');
      return Promise.resolve('stale');
    });
    expect(body).toBe('stale');
    expect(cache.get('t1', 'view')).toBeUndefined();
  });
});
