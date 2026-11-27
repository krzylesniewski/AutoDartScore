import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHECKOUT_HINTS_STORAGE_KEY, readCheckoutHintsEnabled, writeCheckoutHintsEnabled } from './checkout-hints';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('readCheckoutHintsEnabled', () => {
  it('gives on without an entry', () => {
    expect(readCheckoutHintsEnabled()).toBe(true);
  });

  it('gives off for a stored off', () => {
    localStorage.setItem(CHECKOUT_HINTS_STORAGE_KEY, 'off');
    expect(readCheckoutHintsEnabled()).toBe(false);
  });

  it.each(['on', 'Off', 'nie', ''])('gives on for %j', (value) => {
    localStorage.setItem(CHECKOUT_HINTS_STORAGE_KEY, value);
    expect(readCheckoutHintsEnabled()).toBe(true);
  });

  it('gives on when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readCheckoutHintsEnabled()).toBe(true);
  });
});

describe('writeCheckoutHintsEnabled', () => {
  it('stores the choice under autoscore.checkoutHints', () => {
    writeCheckoutHintsEnabled(false);
    expect(localStorage.getItem('autoscore.checkoutHints')).toBe('off');
    writeCheckoutHintsEnabled(true);
    expect(localStorage.getItem('autoscore.checkoutHints')).toBe('on');
  });

  it('does not throw when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => writeCheckoutHintsEnabled(false)).not.toThrow();
  });
});
