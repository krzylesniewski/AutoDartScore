import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createToken, passwordMatches, verifyToken } from './credentials.js';

const auth = { password: 'tajne hasło', tokenSecret: 's'.repeat(32) };
const now = Date.parse('2026-10-20T18:00:00.000Z');
const expiresAt = now + TOKEN_TTL_MS;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

describe('createToken and verifyToken', () => {
  it('lasts 30 days', () => {
    expect(TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('round-trips a token that carries only the version, the expiry and the signature', () => {
    const token = createToken(auth, expiresAt);
    expect(token).toMatch(/^v2\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(token.split('.')[1]).toBe(String(expiresAt));
    expect(verifyToken(auth, token, now)).toBe(true);
    expect(verifyToken(auth, token, expiresAt - 1)).toBe(true);
  });

  it('rejects a token that expires exactly now or earlier', () => {
    const token = createToken(auth, expiresAt);
    expect(verifyToken(auth, token, expiresAt)).toBe(false);
    expect(verifyToken(auth, token, expiresAt + 1)).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    expect(verifyToken(auth, createToken({ ...auth, tokenSecret: 'o'.repeat(32) }, expiresAt), now)).toBe(false);
  });

  it('rejects a token made before a password change with the same secret', () => {
    const token = createToken({ ...auth, password: 'old' }, expiresAt);
    expect(verifyToken({ ...auth, password: 'new' }, token, now)).toBe(false);
    expect(verifyToken({ ...auth, password: 'old' }, token, now)).toBe(true);
  });

  it('rejects a correctly signed legacy v1 token', () => {
    const payload = `v1.${expiresAt}`;
    const signature = createHmac('sha256', auth.tokenSecret).update(payload).digest('base64url');
    expect(verifyToken(auth, `${payload}.${signature}`, now)).toBe(false);
  });

  it('rejects a tampered expiry', () => {
    const [version, , signature] = createToken(auth, now + 1000).split('.');
    expect(verifyToken(auth, `${version}.${expiresAt}.${signature}`, now)).toBe(false);
  });

  it('rejects every other last character of the signature', () => {
    const token = createToken(auth, expiresAt);
    const last = token.at(-1);
    const others = [...BASE64URL].filter((char) => char !== last);
    expect(others).toHaveLength(63);
    for (const char of others) {
      expect(verifyToken(auth, `${token.slice(0, -1)}${char}`, now), char).toBe(false);
    }
  });

  it.each(['=', 'A', '==', '!', ' '])('rejects the signature with %j appended', (suffix) => {
    expect(verifyToken(auth, `${createToken(auth, expiresAt)}${suffix}`, now)).toBe(false);
  });

  it('rejects a wrong part count', () => {
    const token = createToken(auth, expiresAt);
    const [version, expiry, signature] = token.split('.');
    expect(verifyToken(auth, `${version}.${expiry}`, now)).toBe(false);
    expect(verifyToken(auth, `${token}.extra`, now)).toBe(false);
    expect(verifyToken(auth, `${version}.${expiry}.${signature}.`, now)).toBe(false);
    expect(verifyToken(auth, '', now)).toBe(false);
  });

  it('rejects another version and a non-numeric expiry', () => {
    const signature = createToken(auth, expiresAt).split('.')[2];
    expect(verifyToken(auth, `v1.${expiresAt}.${signature}`, now)).toBe(false);
    expect(verifyToken(auth, `v3.${expiresAt}.${signature}`, now)).toBe(false);
    expect(verifyToken(auth, `v2.-${expiresAt}.${signature}`, now)).toBe(false);
    expect(verifyToken(auth, `v2.1e15.${signature}`, now)).toBe(false);
    expect(verifyToken(auth, `v2.${'9'.repeat(20)}.${signature}`, now)).toBe(false);
  });

  it.each(['zażółć.gęślą.jaźń', 'v2.ąę.🎯', `v2.${expiresAt}.${'ż'.repeat(43)}`, '\u0000.\u0000.\u0000'])('rejects the garbage %j', (token) => {
    expect(verifyToken(auth, token, now)).toBe(false);
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
