import { createHmac } from 'node:crypto';
import { ApiError, LoginResponse } from '@autoscore/schema';
import { afterEach, describe, expect, it } from 'vitest';
import { TOKEN_TTL_MS, createToken } from '../auth/credentials.js';
import { MAX_FAILURES_GLOBAL, MAX_FAILURES_PER_CLIENT } from '../auth/login-limiter.js';
import { setup, type TestApp } from '../test-helpers.js';

const password = 'tajne hasło';
const tokenSecret = 's'.repeat(32);
const auth = { password, tokenSecret };
const clock = { now: 0 };

let t: TestApp | null = null;
let other: TestApp | null = null;
afterEach(async () => {
  await t?.close();
  await other?.close();
  t = null;
  other = null;
});

async function withAuth(options: Parameters<typeof setup>[0] = {}): Promise<TestApp> {
  clock.now = Date.parse('2026-10-20T18:00:00.000Z');
  t = await setup({ auth, now: () => clock.now, ...options });
  return t;
}

function listPlayers(app: TestApp['app'], authorization?: string) {
  return app.inject({ method: 'GET', url: '/players', headers: authorization === undefined ? {} : { authorization } });
}

function login(app: TestApp['app'], payload: object, from: { remoteAddress?: string; forwardedFor?: string } = {}) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload,
    ...(from.remoteAddress === undefined ? {} : { remoteAddress: from.remoteAddress }),
    headers: from.forwardedFor === undefined ? {} : { 'x-forwarded-for': from.forwardedFor },
  });
}

function errorCode(response: { json(): unknown }): string {
  return ApiError.parse(response.json()).error;
}

function legacyV1Token(expiresAtMs: number): string {
  const payload = `v1.${expiresAtMs}`;
  return `${payload}.${createHmac('sha256', tokenSecret).update(payload).digest('base64url')}`;
}

describe('token check', () => {
  it('accepts a valid bearer token with any scheme case', async () => {
    const { app } = await withAuth();
    const token = createToken(auth, clock.now + 1000);
    expect((await listPlayers(app, `Bearer ${token}`)).statusCode).toBe(200);
    expect((await listPlayers(app, `bearer ${token}`)).statusCode).toBe(200);
  });

  it.each([
    ['no header', undefined],
    ['a non-Bearer scheme', `Basic ${Buffer.from(`user:${password}`).toString('base64')}`],
    ['a bare token', createToken(auth, Date.parse('2027-01-01T00:00:00.000Z'))],
    ['a garbage token', 'Bearer not-a-token'],
    ['an expired token', `Bearer ${createToken(auth, Date.parse('2026-10-20T18:00:00.000Z'))}`],
    ['a token signed with another secret', `Bearer ${createToken({ password, tokenSecret: 'o'.repeat(32) }, Date.parse('2027-01-01T00:00:00.000Z'))}`],
    ['a correctly signed v1 token', `Bearer ${legacyV1Token(Date.parse('2027-01-01T00:00:00.000Z'))}`],
  ])('rejects %s with 401', async (_name, authorization) => {
    const { app } = await withAuth();
    const response = await listPlayers(app, authorization);
    expect(response.statusCode).toBe(401);
    expect(errorCode(response)).toBe('unauthorized');
  });

  it('rejects a token from a login before a password change with 401', async () => {
    const { app } = await withAuth();
    const response = await login(app, { password });
    expect(response.statusCode).toBe(200);
    const { token } = LoginResponse.parse(response.json());

    other = await setup({ auth: { password: 'nowe hasło', tokenSecret }, now: () => clock.now });
    const rejected = await listPlayers(other.app, `Bearer ${token}`);
    expect(rejected.statusCode).toBe(401);
    expect(errorCode(rejected)).toBe('unauthorized');
  });

  it('answers 401 for an unknown route without a token and 404 with one', async () => {
    const { app } = await withAuth();
    const withoutToken = await app.inject({ method: 'GET', url: '/nope' });
    expect(withoutToken.statusCode).toBe(401);
    expect(errorCode(withoutToken)).toBe('unauthorized');

    const authorization = `Bearer ${createToken(auth, clock.now + 1000)}`;
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
  it('returns a v2 token valid for 30 days that opens the API', async () => {
    const { app } = await withAuth();
    const response = await login(app, { password });
    expect(response.statusCode).toBe(200);
    const { token, expiresAt } = LoginResponse.parse(response.json());
    expect(TOKEN_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(expiresAt).toBe(new Date(clock.now + TOKEN_TTL_MS).toISOString());
    expect(token).toMatch(/^v2\.\d+\.[A-Za-z0-9_-]{43}$/);
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

  it('blocks only the address that failed 10 times', async () => {
    const { app } = await withAuth();
    for (let attempt = 1; attempt <= MAX_FAILURES_PER_CLIENT; attempt++) {
      const response = await login(app, { password: `zgadywanie-${attempt}` }, { remoteAddress: '10.0.0.1' });
      expect(response.statusCode, `attempt ${attempt}`).toBe(401);
    }

    const blocked = await login(app, { password }, { remoteAddress: '10.0.0.1' });
    expect(blocked.statusCode).toBe(429);
    expect(errorCode(blocked)).toBe('too_many_attempts');
    expect(blocked.headers['retry-after']).toBe('60');

    expect((await login(app, { password }, { remoteAddress: '10.0.0.2' })).statusCode).toBe(200);
  });

  it('blocks a fresh address once failures spread over many addresses reach the global limit', async () => {
    const { app } = await withAuth();
    const perAddress = MAX_FAILURES_PER_CLIENT - 1;
    for (let attempt = 0; attempt < MAX_FAILURES_GLOBAL; attempt++) {
      const remoteAddress = `10.1.0.${Math.floor(attempt / perAddress)}`;
      const response = await login(app, { password: `zgadywanie-${attempt}` }, { remoteAddress });
      expect(response.statusCode, `attempt ${attempt + 1}`).toBe(401);
    }

    const blocked = await login(app, { password }, { remoteAddress: '10.2.0.1' });
    expect(blocked.statusCode).toBe(429);
    expect(errorCode(blocked)).toBe('too_many_attempts');
  });
});

describe('client address behind a proxy', () => {
  async function failTenTimes(app: TestApp['app'], forwardedFor: (attempt: number) => string): Promise<void> {
    for (let attempt = 1; attempt <= MAX_FAILURES_PER_CLIENT; attempt++) {
      const response = await login(app, { password: `zgadywanie-${attempt}` }, { remoteAddress: '192.168.1.1', forwardedFor: forwardedFor(attempt) });
      expect(response.statusCode, `attempt ${attempt}`).toBe(401);
    }
  }

  it('counts failures per X-Forwarded-For address with trustProxy on', async () => {
    const { app } = await withAuth({ trustProxy: true });
    await failTenTimes(app, () => '1.1.1.1');
    expect((await login(app, { password }, { remoteAddress: '192.168.1.1', forwardedFor: '1.1.1.1' })).statusCode).toBe(429);
    expect((await login(app, { password }, { remoteAddress: '192.168.1.1', forwardedFor: '2.2.2.2' })).statusCode).toBe(200);
  });

  it('ignores X-Forwarded-For by default', async () => {
    const { app } = await withAuth();
    await failTenTimes(app, (attempt) => `10.9.0.${attempt}`);
    const blocked = await login(app, { password }, { remoteAddress: '192.168.1.1', forwardedFor: '2.2.2.2' });
    expect(blocked.statusCode).toBe(429);
    expect(errorCode(blocked)).toBe('too_many_attempts');
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
