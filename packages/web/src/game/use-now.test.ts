import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './use-now';

const NOW = Date.parse('2026-10-21T18:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useNow', () => {
  it('re-renders every second while ticking', () => {
    const { result } = renderHook(() => useNow(true));
    expect(result.current).toBe(NOW);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(NOW + 1000);
  });

  it('sets no timer while not ticking', () => {
    renderHook(() => useNow(false));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops when ticking turns off and on unmount', () => {
    const { rerender, unmount } = renderHook(({ ticking }) => useNow(ticking), { initialProps: { ticking: true } });
    expect(vi.getTimerCount()).toBe(1);
    rerender({ ticking: false });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ ticking: true });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
