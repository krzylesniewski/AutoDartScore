import { afterEach, describe, expect, it, vi } from 'vitest';
import { snapshot } from '../test/snapshots';
import { ApiRequestError, REQUEST_TIMEOUT_MS, getMatch } from './client';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('request time limit', () => {
  it('passes a timeout signal to fetch', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(snapshot({ id: 'm1' })), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await getMatch('m1');
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    expect(signal).toBe(timeout.mock.results[0]?.value);
  });

  it('rejects a timed out request with an error that is not ApiRequestError', async () => {
    const timedOut = new DOMException('timeout', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(timedOut)));
    const caught: unknown = await getMatch('m1').catch((error: unknown) => error);
    expect(caught).toBe(timedOut);
    expect(caught).not.toBeInstanceOf(ApiRequestError);
  });
});
