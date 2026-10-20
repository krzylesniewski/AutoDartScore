import { describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createToken, passwordMatches, verifyToken } from './credentials.js';

const secret = 's'.repeat(32);
const now = Date.parse('2026-10-20T18:00:00.000Z');
const expiresAt = now + TOKEN_TTL_MS;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

describe('createToken and verifyToken', () => {
  it('lasts 180 days', () => {
    expect(TOKEN_TTL_MS).toBe(180 * 24 * 60 * 60 * 1000);
  });

  it('round-trips a token that carries only the version, the expiry and the signature', () => {
    const token = createToken(secret, expiresAt);
    expect(token).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(token.split('.')[1]).toBe(String(expiresAt));
    expect(verifyToken(secret, token, now)).toBe(true);
    expect(verifyToken(secret, token, expiresAt - 1)).toBe(true);
  });

  it('rejects a token that expires exactly now or earlier', () => {
    const token = createToken(secret, expiresAt);
    expect(verifyToken(secret, token, expiresAt)).toBe(false);
    expect(verifyToken(secret, token, expiresAt + 1)).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    expect(verifyToken(secret, createToken('o'.repeat(32), expiresAt), now)).toBe(false);
  });

  it('rejects a tampered expiry', () => {
    const [version, , signature] = createToken(secret, now + 1000).split('.');
    expect(verifyToken(secret, `${version}.${expiresAt}.${signature}`, now)).toBe(false);
  });

  it('rejects every other last character of the signature', () => {
    const token = createToken(secret, expiresAt);
    const last = token.at(-1);
    const others = [...BASE64URL].filter((char) => char !== last);
    expect(others).toHaveLength(63);
    for (const char of others) {
      expect(verifyToken(secret, `${token.slice(0, -1)}${char}`, now), char).toBe(false);
    }
  });

  it.each(['=', 'A', '==', '!', ' '])('rejects the signature with %j appended', (suffix) => {
    expect(verifyToken(secret, `${createToken(secret, expiresAt)}${suffix}`, now)).toBe(false);
  });

  it('rejects a wrong part count', () => {
    const token = createToken(secret, expiresAt);
    const [version, expiry, signature] = token.split('.');
    expect(verifyToken(secret, `${version}.${expiry}`, now)).toBe(false);
    expect(verifyToken(secret, `${token}.extra`, now)).toBe(false);
    expect(verifyToken(secret, `${version}.${expiry}.${signature}.`, now)).toBe(false);
    expect(verifyToken(secret, '', now)).toBe(false);
  });

  it('rejects another version and a non-numeric expiry', () => {
    const signature = createToken(secret, expiresAt).split('.')[2];
    expect(verifyToken(secret, `v2.${expiresAt}.${signature}`, now)).toBe(false);
    expect(verifyToken(secret, `v1.-${expiresAt}.${signature}`, now)).toBe(false);
    expect(verifyToken(secret, `v1.1e15.${signature}`, now)).toBe(false);
    expect(verifyToken(secret, `v1.${'9'.repeat(20)}.${signature}`, now)).toBe(false);
  });

  it.each(['zażółć.gęślą.jaźń', 'v1.ąę.🎯', `v1.${expiresAt}.${'ż'.repeat(43)}`, '\u0000.\u0000.\u0000'])('rejects the garbage %j', (token) => {
    expect(verifyToken(secret, token, now)).toBe(false);
  });
});

describe('passwordMatches', () => {
  it('accepts the same password', () => {
    expect(passwordMatches('tajne hasło', 'tajne hasło')).toBe(true);
  });

  it.each(['tajne', 'tajne hasło ', 'TAJNE HASŁO', '', 'x'.repeat(500)])('rejects %j', (given) => {
    expect(passwordMatches('tajne hasło', given)).toBe(false);
  });
});
