import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './use-media-query';

class FakeMediaQueryList extends EventTarget {
  matches: boolean;

  constructor(matches: boolean) {
    super();
    this.matches = matches;
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('does not match without matchMedia', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 64rem)'));
    expect(result.current).toBe(false);
  });

  it('follows the media query list', () => {
    const list = new FakeMediaQueryList(true);
    const matchMedia = vi.fn(() => list);
    vi.stubGlobal('matchMedia', matchMedia);
    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 64rem)'));
    expect(result.current).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 64rem)');
    act(() => {
      list.change(false);
    });
    expect(result.current).toBe(false);
    unmount();
  });
});
