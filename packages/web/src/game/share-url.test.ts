import { describe, expect, it } from 'vitest';
import { isLocalAddress, publicTournamentUrl } from './share-url';

describe('publicTournamentUrl', () => {
  it('joins the origin, the path and the public route', () => {
    expect(publicTournamentUrl({ origin: 'http://192.168.1.20:5173', pathname: '/' }, 't1')).toBe('http://192.168.1.20:5173/#/t/t1');
  });

  it('keeps a base path and encodes the id', () => {
    expect(publicTournamentUrl({ origin: 'https://dart.example.com', pathname: '/app/' }, 't 1/2')).toBe(
      'https://dart.example.com/app/#/t/t%201%2F2',
    );
  });
});

describe('isLocalAddress', () => {
  it('is true for localhost and 127.0.0.1 only', () => {
    expect(isLocalAddress('localhost')).toBe(true);
    expect(isLocalAddress('127.0.0.1')).toBe(true);
    expect(isLocalAddress('192.168.1.20')).toBe(false);
    expect(isLocalAddress('dart.example.com')).toBe(false);
    expect(isLocalAddress('localhost.example.com')).toBe(false);
  });
});
