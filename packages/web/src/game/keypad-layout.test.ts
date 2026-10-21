import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEYPAD_LAYOUT_STORAGE_KEY, readKeypadLayout, writeKeypadLayout } from './keypad-layout';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('readKeypadLayout', () => {
  it('gives the ring without an entry', () => {
    expect(readKeypadLayout()).toBe('ring');
  });

  it('gives the grid for a stored grid', () => {
    localStorage.setItem(KEYPAD_LAYOUT_STORAGE_KEY, 'grid');
    expect(readKeypadLayout()).toBe('grid');
  });

  it.each(['ring', 'Grid', 'siatka', ''])('gives the ring for %j', (value) => {
    localStorage.setItem(KEYPAD_LAYOUT_STORAGE_KEY, value);
    expect(readKeypadLayout()).toBe('ring');
  });

  it('gives the ring when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readKeypadLayout()).toBe('ring');
  });
});

describe('writeKeypadLayout', () => {
  it('stores the layout under autoscore.keypadLayout', () => {
    writeKeypadLayout('grid');
    expect(localStorage.getItem('autoscore.keypadLayout')).toBe('grid');
    writeKeypadLayout('ring');
    expect(localStorage.getItem('autoscore.keypadLayout')).toBe('ring');
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeKeypadLayout('grid')).not.toThrow();
  });
});
