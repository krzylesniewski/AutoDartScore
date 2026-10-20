import { describe, expect, it } from 'vitest';
import { LiveAuthMessage, LoginRequest, LoginResponse } from './index.js';

describe('LoginRequest', () => {
  it('keeps spaces in the password', () => {
    expect(LoginRequest.parse({ password: ' tajne hasło ' })).toEqual({ password: ' tajne hasło ' });
  });

  it.each([
    ['an empty password', { password: '' }],
    ['a password over 200 characters', { password: 'a'.repeat(201) }],
    ['a numeric password', { password: 1234 }],
    ['a missing password', {}],
  ])('rejects %s', (_name, value) => {
    expect(LoginRequest.safeParse(value).success).toBe(false);
  });
});

describe('LoginResponse', () => {
  it('accepts a token with an ISO expiry', () => {
    const response = { token: 'v1.1.abc', expiresAt: '2027-04-18T18:30:00.000Z' };
    expect(LoginResponse.parse(response)).toEqual(response);
  });

  it.each([
    ['an empty token', { token: '', expiresAt: '2027-04-18T18:30:00.000Z' }],
    ['a non-ISO expiry', { token: 'v1.1.abc', expiresAt: '18.04.2027' }],
    ['a missing expiry', { token: 'v1.1.abc' }],
  ])('rejects %s', (_name, value) => {
    expect(LoginResponse.safeParse(value).success).toBe(false);
  });
});

describe('LiveAuthMessage', () => {
  it('accepts an auth message with a token', () => {
    expect(LiveAuthMessage.parse({ type: 'auth', token: 'v1.1.abc' })).toEqual({ type: 'auth', token: 'v1.1.abc' });
  });

  it.each([
    ['another type', { type: 'subscribe', token: 'v1.1.abc' }],
    ['an empty token', { type: 'auth', token: '' }],
    ['a missing token', { type: 'auth' }],
    ['a missing type', { token: 'v1.1.abc' }],
  ])('rejects %s', (_name, value) => {
    expect(LiveAuthMessage.safeParse(value).success).toBe(false);
  });
});
