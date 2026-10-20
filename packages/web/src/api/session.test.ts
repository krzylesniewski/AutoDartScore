import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_STORAGE_KEY, UNAUTHORIZED_EVENT, clearToken, handleUnauthorized, onUnauthorized, readToken, saveToken } from './session';

afterEach(() => {
  clearToken();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('session', () => {
  it('saves, reads and clears the token under autoscore.token', () => {
    expect(TOKEN_STORAGE_KEY).toBe('autoscore.token');
    expect(readToken()).toBeNull();
    saveToken('t1');
    expect(localStorage.getItem('autoscore.token')).toBe('t1');
    expect(readToken()).toBe('t1');
    clearToken();
    expect(localStorage.getItem('autoscore.token')).toBeNull();
    expect(readToken()).toBeNull();
  });

  it('clears the current token and fires the event once', () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    saveToken('t1');
    handleUnauthorized('t1');
    expect(readToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('keeps a token saved after the rejected request left', () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    saveToken('t2');
    handleUnauthorized('t1');
    expect(readToken()).toBe('t2');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('fires the event when no token was sent and none is stored', () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    handleUnauthorized(null);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops the listener after unsubscribe', () => {
    const listener = vi.fn();
    onUnauthorized(listener)();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the token in memory when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    saveToken('t1');
    expect(readToken()).toBe('t1');
  });
});
