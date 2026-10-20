import { describe, expect, it } from 'vitest';
import { liveSocketUrl, resolveApiBase } from './api-url';

const httpPage = { protocol: 'http:', host: 'page.example.com:5173' };
const httpsPage = { protocol: 'https:', host: 'page.example.com' };
const livePath = '/matches/m1/live';

function withAndWithoutSlash(raw: string): string[] {
  return [raw, `${raw}/`];
}

describe('resolveApiBase', () => {
  it('falls back to /api when the value is missing or blank', () => {
    expect(resolveApiBase(undefined)).toBe('/api');
    expect(resolveApiBase('')).toBe('/api');
    expect(resolveApiBase('  ')).toBe('/api');
  });

  it('strips trailing slashes from a relative base', () => {
    expect(resolveApiBase('/api')).toBe('/api');
    expect(resolveApiBase('/api/')).toBe('/api');
  });

  it('turns a lone slash into an empty base', () => {
    expect(resolveApiBase('/')).toBe('');
  });

  it('strips trailing slashes from an absolute base', () => {
    expect(resolveApiBase('https://api.example.com')).toBe('https://api.example.com');
    expect(resolveApiBase('https://api.example.com/')).toBe('https://api.example.com');
    expect(resolveApiBase('http://192.168.1.10:3000')).toBe('http://192.168.1.10:3000');
    expect(resolveApiBase('http://192.168.1.10:3000/')).toBe('http://192.168.1.10:3000');
  });

  it('keeps a path prefix of an absolute base', () => {
    expect(resolveApiBase('https://api.example.com/v1/')).toBe('https://api.example.com/v1');
  });

  it('rejects a value without a scheme or a leading slash', () => {
    expect(() => resolveApiBase('api.example.com')).toThrow(/VITE_API_URL.*api\.example\.com/);
  });
});

describe('REST URL', () => {
  it.each([
    ...withAndWithoutSlash('/api').map((raw) => [raw, '/api/players']),
    ...withAndWithoutSlash('https://api.example.com').map((raw) => [raw, 'https://api.example.com/players']),
    ...withAndWithoutSlash('http://192.168.1.10:3000').map((raw) => [raw, 'http://192.168.1.10:3000/players']),
  ])('%s gives %s', (raw, expected) => {
    expect(`${resolveApiBase(raw)}/players`).toBe(expected);
  });
});

describe('liveSocketUrl', () => {
  it.each(withAndWithoutSlash('/api'))('builds %s from the page host over http', (raw) => {
    expect(liveSocketUrl(resolveApiBase(raw), livePath, httpPage)).toBe('ws://page.example.com:5173/api/matches/m1/live');
  });

  it.each(withAndWithoutSlash('/api'))('builds %s from the page host over https', (raw) => {
    expect(liveSocketUrl(resolveApiBase(raw), livePath, httpsPage)).toBe('wss://page.example.com/api/matches/m1/live');
  });

  it('builds a root base from the page host', () => {
    expect(liveSocketUrl(resolveApiBase('/'), livePath, httpPage)).toBe('ws://page.example.com:5173/matches/m1/live');
  });

  it.each([
    ...withAndWithoutSlash('https://api.example.com').map((raw) => [raw, 'wss://api.example.com/matches/m1/live']),
    ...withAndWithoutSlash('http://192.168.1.10:3000').map((raw) => [raw, 'ws://192.168.1.10:3000/matches/m1/live']),
  ])('uses the address of %s instead of the page host', (raw, expected) => {
    for (const page of [httpPage, httpsPage]) {
      const url = liveSocketUrl(resolveApiBase(raw), livePath, page);
      expect(url).toBe(expected);
      expect(url).not.toContain(page.host);
    }
  });

  it('keeps a path prefix of an absolute base', () => {
    expect(liveSocketUrl(resolveApiBase('https://api.example.com/v1/'), livePath, httpsPage)).toBe('wss://api.example.com/v1/matches/m1/live');
  });
});
