import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from './client';
import { PUBLIC_POLL_INTERVAL_MS, usePublicPoll } from './use-public-poll';

const notFound = () => new ApiRequestError(404, 'not_found', 'Not found');
const tooMany = () => new ApiRequestError(429, 'too_many_requests', 'Too many requests');

// Pozwala rozstrzygnąć obietnice loadera bez przesuwania zegara.
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePublicPoll', () => {
  it('loads at mount and again 10 000 ms after the previous answer, not before', async () => {
    const load = vi.fn(() => Promise.resolve('v1'));
    const { result } = renderHook(() => usePublicPoll(load, ['t1']));
    expect(result.current).toEqual({ status: 'loading', data: null, refreshFailed: false });
    expect(load).toHaveBeenCalledTimes(1);
    await settle();
    expect(result.current).toEqual({ status: 'ready', data: 'v1', refreshFailed: false });

    await advance(PUBLIC_POLL_INTERVAL_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('waits for a slow answer before counting the next 10 000 ms, so requests never overlap', async () => {
    let resolve: (value: string) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    renderHook(() => usePublicPoll(load, ['t1']));
    await advance(PUBLIC_POLL_INTERVAL_MS * 3);
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve('v1');
      await Promise.resolve();
    });
    await advance(PUBLIC_POLL_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('stops after a 404', async () => {
    const load = vi.fn(() => Promise.reject(notFound()));
    const { result } = renderHook(() => usePublicPoll(load, ['t1']));
    await settle();
    expect(result.current).toEqual({ status: 'not_found', data: null, refreshFailed: false });
    await advance(PUBLIC_POLL_INTERVAL_MS * 5);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the last data after a failed refresh, keeps polling and clears the flag on success', async () => {
    const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce('v1').mockRejectedValueOnce(tooMany()).mockResolvedValueOnce('v2');
    const { result } = renderHook(() => usePublicPoll(load, ['t1']));
    await settle();
    await advance(PUBLIC_POLL_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ status: 'ready', data: 'v1', refreshFailed: true });
    await advance(PUBLIC_POLL_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(3);
    expect(result.current).toEqual({ status: 'ready', data: 'v2', refreshFailed: false });
  });

  it('reports an error before any data and keeps trying', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce('v1');
    const { result } = renderHook(() => usePublicPoll(load, ['t1']));
    await settle();
    expect(result.current.status).toBe('error');
    await advance(PUBLIC_POLL_INTERVAL_MS);
    expect(result.current).toEqual({ status: 'ready', data: 'v1', refreshFailed: false });
  });

  it('does not restart for a new loader with the same ids, and restarts for new ids', async () => {
    const first = vi.fn(() => Promise.resolve('a'));
    const second = vi.fn(() => Promise.resolve('b'));
    const { result, rerender } = renderHook(({ load, id }) => usePublicPoll(load, [id]), { initialProps: { load: first, id: 't1' } });
    await settle();
    rerender({ load: second, id: 't1' });
    await settle();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    await advance(PUBLIC_POLL_INTERVAL_MS);
    expect(second).toHaveBeenCalledTimes(1);

    rerender({ load: second, id: 't2' });
    expect(result.current).toEqual({ status: 'loading', data: null, refreshFailed: false });
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('clears the timer on unmount and sets no state afterwards', async () => {
    const load = vi.fn(() => Promise.resolve('v1'));
    const { result, unmount } = renderHook(() => usePublicPoll(load, ['t1']));
    unmount();
    await settle();
    expect(result.current.status).toBe('loading');
    await advance(PUBLIC_POLL_INTERVAL_MS * 2);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
