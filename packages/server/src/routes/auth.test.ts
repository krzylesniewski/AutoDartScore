import { ApiError, LoginResponse } from '@autoscore/schema';
import { afterEach, describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createToken } from '../auth/credentials.js';
import { setup, type TestApp } from '../test-helpers.js';

const password = 'tajne hasło';
const tokenSecret = 's'.repeat(32);
const clock = { now: 0 };

let t: TestApp | null = null;
afterEach(async () => {
  await t?.close();
  t = null;
});

async function withAuth(): Promise<TestApp> {
  clock.now = Date.parse('2026-10-20T18:00:00.000Z');
  t = await setup({ auth: { password, tokenSecret }, now: () => clock.now });
  return t;
}

function listPlayers(app: TestApp['app'], authorization?: string) {
  return app.inject({ method: 'GET', url: '/players', headers: authorization === undefined ? {} : { authorization } });
}

function login(app: TestApp['app'], payload: object) {
  return app.inject({ method: 'POST', url: '/auth/login', payload });
}

function errorCode(response: { json(): unknown }): string {
  return ApiError.parse(response.json()).error;
}

describe('token check', () => {
  it('accepts a valid bearer token with any scheme case', async () => {
    const { app } = await withAuth();
    const token = createToken(tokenSecret, clock.now + 1000);
    expect((await listPlayers(app, `Bearer ${token}`)).statusCode).toBe(200);
    expect((await listPlayers(app, `bearer ${token}`)).statusCode).toBe(200);
  });

  it.each([
    ['no header', undefined],
    ['a non-Bearer scheme', `Basic ${Buffer.from(`user:${password}`).toString('base64')}`],
    ['a bare token', createToken(tokenSecret, Date.parse('2027-01-01T00:00:00.000Z'))],
    ['a garbage token', 'Bearer not-a-token'],
    ['an expired token', `Bearer ${createToken(tokenSecret, Date.parse('2026-10-20T18:00:00.000Z'))}`],
    ['a token signed with another secret', `Bearer ${createToken('o'.repeat(32), Date.parse('2027-01-01T00:00:00.000Z'))}`],
  ])('rejects %s with 401', async (_name, authorization) => {
    const { app } = await withAuth();
    const response = await listPlayers(app, authorization);
    expect(response.statusCode).toBe(401);
    expect(errorCode(response)).toBe('unauthorized');
  });

  it('answers 401 for an unknown route without a token and 404 with one', async () => {
    const { app } = await withAuth();
    const withoutToken = await app.inject({ method: 'GET', url: '/nope' });
    expect(withoutToken.statusCode).toBe(401);
    expect(errorCode(withoutToken)).toBe('unauthorized');

    const authorization = `Bearer ${createToken(tokenSecret, clock.now + 1000)}`;
    const withToken = await app.inject({ method: 'GET', url: '/nope', headers: { authorization } });
    expect(withToken.statusCode).toBe(404);
    expect(errorCode(withToken)).toBe('not_found');
  });

  it('serves /health without a token', async () => {
    const { app } = await withAuth();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /auth/login', () => {
  it('returns a token valid for 180 days that opens the API', async () => {
    const { app } = await withAuth();
    const response = await login(app, { password });
    expect(response.statusCode).toBe(200);
    const { token, expiresAt } = LoginResponse.parse(response.json());
    expect(expiresAt).toBe(new Date(clock.now + TOKEN_TTL_MS).toISOString());
    expect(token).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain(password);
    expect((await listPlayers(app, `Bearer ${token}`)).statusCode).toBe(200);
  });

  it('rejects a wrong password with 401 invalid_password', async () => {
    const { app } = await withAuth();
    const response = await login(app, { password: 'zgadywanie' });
    expect(response.statusCode).toBe(401);
    expect(errorCode(response)).toBe('invalid_password');
  });

  it('answers 400 for an invalid body without counting it as a failure', async () => {
    const { app } = await withAuth();
    for (const payload of [{}, { password: '' }, { password: 42 }, { pass: password }, {}, {}, {}, {}, {}, {}, {}]) {
      const response = await login(app, payload);
      expect(response.statusCode).toBe(400);
      expect(errorCode(response)).toBe('invalid_request');
    }
    expect((await login(app, { password })).statusCode).toBe(200);
  });

  it('blocks the 11th attempt after 10 failures, even with the correct password, for 60 s', async () => {
    const { app } = await withAuth();
    for (let attempt = 1; attempt <= 10; attempt++) {
      const response = await login(app, { password: `zgadywanie-${attempt}` });
      expect(response.statusCode, `attempt ${attempt}`).toBe(401);
    }

    const blocked = await login(app, { password });
    expect(blocked.statusCode).toBe(429);
    expect(errorCode(blocked)).toBe('too_many_attempts');
    expect(blocked.headers['retry-after']).toBe('60');

    clock.now += 60_000;
    expect((await login(app, { password })).statusCode).toBe(200);
  });
});

describe('without a password', () => {
  it('has no login route and needs no token', async () => {
    t = await setup();
    expect((await login(t.app, { password })).statusCode).toBe(404);
    const health = await t.app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: 'ok' });
    expect((await listPlayers(t.app)).statusCode).toBe(200);
  });
});
