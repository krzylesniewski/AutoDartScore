import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshot } from '../test/snapshots';
import { useUndoWindow } from './use-undo-window';

const UNTIL = '2026-10-21T20:05:00.000Z';
const finished = snapshot({ finished: true, currentPlayerId: null, winnerId: 'p1', finishedAt: '2026-10-21T20:00:00.000Z', editableUntil: UNTIL });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse(UNTIL) - 2000);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useUndoWindow', () => {
  it('ticks every second until the window closes and then stops', () => {
    const { result } = renderHook(() => useUndoWindow(finished));
    expect(result.current).toEqual({ locked: false, secondsLeft: 2 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toEqual({ locked: false, secondsLeft: 1 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toEqual({ locked: true, secondsLeft: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not tick in a game in progress', () => {
    const { result } = renderHook(() => useUndoWindow(snapshot()));
    expect(result.current).toEqual({ locked: false, secondsLeft: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the interval on unmount', () => {
    const { unmount } = renderHook(() => useUndoWindow(finished));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
