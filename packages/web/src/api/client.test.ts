import { afterEach, describe, expect, it, vi } from 'vitest';
import { snapshot } from '../test/snapshots';
import { ApiRequestError, REQUEST_TIMEOUT_MS, StaleStateRequestError, getMatch, undo } from './client';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('409 replies', () => {
  it('rejects a stale_state body with StaleStateRequestError carrying the parsed state', async () => {
    const state = snapshot({ id: 'm1', eventSeq: 9 });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(409, { error: 'stale_state', message: 'Match state changed', state }))),
    );
    const caught: unknown = await undo('m1', 7).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(StaleStateRequestError);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).toMatchObject({
      name: 'StaleStateRequestError',
      status: 409,
      code: 'stale_state',
      message: 'Match state changed',
      state,
    });
  });

  it('rejects a 409 with another code with a plain ApiRequestError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(409, { error: 'nothing_to_undo', message: 'Match has no throw to undo' }))),
    );
    const caught: unknown = await undo('m1', 7).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(ApiRequestError);
    expect(caught).not.toBeInstanceOf(StaleStateRequestError);
    expect(caught).toMatchObject({ status: 409, code: 'nothing_to_undo' });
  });
});

describe('undo request', () => {
  function stubUndo() {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(json(200, { undoneThrowId: 't1', state: snapshot({ id: 'm1', eventSeq: 8 }) })),
    );
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('sends no body without expectedSeq', async () => {
    const fetch = stubUndo();
    await undo('m1');
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('sends expectedSeq as JSON', async () => {
    const fetch = stubUndo();
    await undo('m1', 7);
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ expectedSeq: 7 });
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('request time limit', () => {
  it('passes a timeout signal to fetch', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.resolve(new Response(JSON.stringify(snapshot({ id: 'm1' })), { status: 200 })),
    );
    vi.stubGlobal('fetch', fetch);
    await getMatch('m1');
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    expect(signal).toBe(timeout.mock.results[0]?.value);
  });

  it('rejects a timed out request with an error that is not ApiRequestError', async () => {
    const timedOut = new DOMException('timeout', 'TimeoutError');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(timedOut)),
    );
    const caught: unknown = await getMatch('m1').catch((error: unknown) => error);
    expect(caught).toBe(timedOut);
    expect(caught).not.toBeInstanceOf(ApiRequestError);
  });
});
