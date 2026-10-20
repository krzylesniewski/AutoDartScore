import { afterEach, describe, expect, it } from 'vitest';
import { setup, type TestApp } from '../test-helpers.js';

const front = 'https://front.example';
const foreign = 'https://evil.example';

const preflightHeaders = {
  'access-control-request-method': 'PATCH',
  'access-control-request-headers': 'authorization,content-type',
};

let t: TestApp | null = null;
afterEach(async () => {
  await t?.close();
  t = null;
});

function corsHeaders(headers: Record<string, unknown>): string[] {
  return Object.keys(headers).filter((name) => name.startsWith('access-control-'));
}

describe('with AUTOSCORE_CORS_ORIGIN', () => {
  it('reflects an allowed origin', async () => {
    t = await setup({ corsOrigins: ['http://localhost:5173', front] });
    const response = await t.app.inject({ method: 'GET', url: '/health', headers: { origin: front } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(front);
  });

  it('answers a preflight for PATCH with the Authorization header', async () => {
    t = await setup({ corsOrigins: [front] });
    const response = await t.app.inject({ method: 'OPTIONS', url: '/players', headers: { origin: front, ...preflightHeaders } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(front);
    expect(String(response.headers['access-control-allow-headers']).toLowerCase()).toContain('authorization');
    expect(String(response.headers['access-control-allow-methods'])).toContain('PATCH');
  });

  it('keeps the CORS header on a 401 and answers a preflight without a token', async () => {
    t = await setup({ corsOrigins: [front], auth: { password: 'tajne', tokenSecret: 's'.repeat(32) } });
    const response = await t.app.inject({ method: 'GET', url: '/players', headers: { origin: front } });
    expect(response.statusCode).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe(front);

    const preflight = await t.app.inject({ method: 'OPTIONS', url: '/players', headers: { origin: front, ...preflightHeaders } });
    expect(preflight.statusCode).toBe(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(front);
  });

  it('gives a foreign origin no allow-origin header', async () => {
    t = await setup({ corsOrigins: [front] });
    const response = await t.app.inject({ method: 'GET', url: '/health', headers: { origin: foreign } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await t.app.inject({ method: 'OPTIONS', url: '/players', headers: { origin: foreign, ...preflightHeaders } });
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('without AUTOSCORE_CORS_ORIGIN', () => {
  it('sends no CORS headers and has no OPTIONS route', async () => {
    t = await setup();
    const response = await t.app.inject({ method: 'GET', url: '/health', headers: { origin: front } });
    expect(response.statusCode).toBe(200);
    expect(corsHeaders(response.headers)).toEqual([]);

    const preflight = await t.app.inject({ method: 'OPTIONS', url: '/players', headers: { origin: front, ...preflightHeaders } });
    expect(preflight.statusCode).toBe(404);
    expect(corsHeaders(preflight.headers)).toEqual([]);
  });
});
