import type { HitEvent } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { createApiClient, type ApiClientOptions } from './api-client.js';

const url = 'http://board-host:3000';
const password = 'tajne hasło';

interface Call {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
  readonly body: string | undefined;
}

type Reply = Response | Error;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Każde wywołanie bierze kolejną odpowiedź z listy. Błąd na liście udaje błąd sieci.
function fakeFetch(replies: readonly ((call: Call) => Reply)[]): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const send: typeof fetch = async (input, init) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call = { method: init?.method ?? 'GET', url: String(input), authorization: headers.authorization, body: init?.body as string | undefined };
    calls.push(call);
    const reply = replies[calls.length - 1];
    if (reply === undefined) {
      throw new Error(`Unexpected call ${call.method} ${call.url}`);
    }
    const result = reply(call);
    if (result instanceof Error) {
      throw result;
    }
    return result;
  };
  return { fetch: send, calls };
}

function client(send: typeof fetch, options: Partial<ApiClientOptions> = {}): { client: ReturnType<typeof createApiClient>; delays: number[] } {
  const delays: number[] = [];
  const sleep = async (ms: number): Promise<void> => {
    delays.push(ms);
  };
  return { client: createApiClient({ api: { url, password: null }, fetch: send, sleep, ...options }), delays };
}

const hit: HitEvent = {
  eventId: '6f1c1b7e-3c1a-4c7e-9a52-0d0f5a1d2b3c',
  matchId: 'm_1',
  source: 'camera-1',
  sequence: 0,
  segment: 20,
  multiplier: 3,
  confidence: 0.95,
  detectedAt: '2026-10-29T18:00:00.000Z',
};

const refused = (): Error => new TypeError('fetch failed', { cause: Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' }) });
const stored = (): Response => json(201, { throw: {}, events: [], state: {} });
const serverError = (): Response => json(503, { error: 'internal_error', message: 'Internal server error' });

describe('createApiClient sendHit', () => {
  it('posts the hit and reports a stored dart', async () => {
    const { fetch, calls } = fakeFetch([stored]);
    const { client: api } = client(fetch);
    await expect(api.sendHit(hit)).resolves.toEqual({ ok: true, status: 201 });
    expect(calls).toEqual([{ method: 'POST', url: `${url}/matches/m_1/throws`, authorization: undefined, body: JSON.stringify(hit) }]);
  });

  it('retries a network error with the same body', async () => {
    const { fetch, calls } = fakeFetch([refused, () => json(200, {})]);
    const { client: api, delays } = client(fetch);
    await expect(api.sendHit(hit)).resolves.toEqual({ ok: true, status: 200 });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body).toBe(calls[0]?.body);
    expect(JSON.parse(calls[1]?.body ?? '')).toEqual(hit);
    expect(delays).toEqual([250]);
  });

  it('retries 5xx', async () => {
    const { fetch, calls } = fakeFetch([serverError, serverError, stored]);
    const { client: api, delays } = client(fetch);
    await expect(api.sendHit(hit)).resolves.toEqual({ ok: true, status: 201 });
    expect(calls).toHaveLength(3);
    expect(delays).toEqual([250, 500]);
  });

  it('does not retry a 409 and reports it as rejected', async () => {
    const { fetch, calls } = fakeFetch([() => json(409, { error: 'turn_pending', message: 'Turn waits for review' })]);
    const { client: api, delays } = client(fetch);
    await expect(api.sendHit(hit)).resolves.toEqual({ ok: false, status: 409, error: 'turn_pending' });
    expect(calls).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it('reports a rejection without an error code', async () => {
    const { fetch } = fakeFetch([() => new Response(null, { status: 404 })]);
    await expect(client(fetch).client.sendHit(hit)).resolves.toEqual({ ok: false, status: 404, error: null });
  });

  it('gives up after every delay with a network error', async () => {
    const retryDelaysMs = [1, 2, 3];
    const { fetch, calls } = fakeFetch(Array.from({ length: 4 }, () => refused));
    const { client: api, delays } = client(fetch, { retryDelaysMs });
    await expect(api.sendHit(hit)).rejects.toThrow(`Cannot reach the server at ${url}: ECONNREFUSED`);
    expect(calls).toHaveLength(retryDelaysMs.length + 1);
    expect(delays).toEqual(retryDelaysMs);
  });

  it('gives up after the default delays with the last HTTP status', async () => {
    const { fetch, calls } = fakeFetch(Array.from({ length: 6 }, () => serverError));
    const { client: api, delays } = client(fetch);
    await expect(api.sendHit(hit)).rejects.toThrow(`Cannot reach the server at ${url}: HTTP 503 internal_error`);
    expect(calls).toHaveLength(6);
    expect(delays).toEqual([250, 500, 1000, 2000, 4000]);
  });

  it('sends a single attempt without retry delays', async () => {
    const { fetch, calls } = fakeFetch([refused]);
    await expect(client(fetch, { retryDelaysMs: [] }).client.sendHit(hit)).rejects.toThrow('Cannot reach the server');
    expect(calls).toHaveLength(1);
  });
});

describe('createApiClient login', () => {
  const loginOk = (token: string) => (): Response => json(200, { token, expiresAt: '2026-10-29T20:00:00.000Z' });
  const unauthorized = (): Response => json(401, { error: 'unauthorized', message: 'Missing or invalid token' });

  it('never logs in without a password', async () => {
    const { fetch, calls } = fakeFetch([() => json(200, []), stored]);
    const { client: api } = client(fetch);
    await api.listUnfinishedMatches();
    await api.sendHit(hit);
    expect(calls.map((call) => call.url)).toEqual([`${url}/matches?status=unfinished`, `${url}/matches/m_1/throws`]);
  });

  it('logs in once and reuses the token', async () => {
    const { fetch, calls } = fakeFetch([loginOk('t1'), () => json(200, []), stored]);
    const { client: api } = client(fetch, { api: { url, password } });
    await api.listUnfinishedMatches();
    await api.sendHit(hit);
    expect(calls.map((call) => `${call.method} ${call.url} ${call.authorization ?? '-'}`)).toEqual([
      `POST ${url}/auth/login -`,
      `GET ${url}/matches?status=unfinished Bearer t1`,
      `POST ${url}/matches/m_1/throws Bearer t1`,
    ]);
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({ password });
  });

  it('logs in again once after a 401 and repeats the request', async () => {
    const { fetch, calls } = fakeFetch([loginOk('t1'), unauthorized, loginOk('t2'), stored]);
    const { client: api } = client(fetch, { api: { url, password } });
    await expect(api.sendHit(hit)).resolves.toEqual({ ok: true, status: 201 });
    expect(calls.map((call) => call.authorization ?? '-')).toEqual(['-', 'Bearer t1', '-', 'Bearer t2']);
    expect(calls[3]?.body).toBe(calls[1]?.body);
  });

  it('fails on a second 401', async () => {
    const { fetch, calls } = fakeFetch([loginOk('t1'), unauthorized, loginOk('t2'), unauthorized]);
    const { client: api } = client(fetch, { api: { url, password } });
    await expect(api.sendHit(hit)).rejects.toThrow('HTTP 401 unauthorized');
    expect(calls).toHaveLength(4);
  });

  it('rejects a wrong password', async () => {
    const { fetch } = fakeFetch([() => json(401, { error: 'invalid_password', message: 'Invalid password' })]);
    await expect(client(fetch, { api: { url, password } }).client.sendHit(hit)).rejects.toThrow('Login failed: invalid AUTOSCORE_PASSWORD');
  });

  it('retries the login while the server is starting', async () => {
    const { fetch, calls } = fakeFetch([refused, loginOk('t1'), () => json(404, { error: 'not_found', message: 'Not found' })]);
    const { client: api, delays } = client(fetch, { api: { url, password } });
    await expect(api.getCalibration('camera-1')).resolves.toBeNull();
    expect(calls).toHaveLength(3);
    expect(delays).toEqual([250]);
  });
});

describe('createApiClient reads', () => {
  const calibration = { imageWidth: 320, imageHeight: 180, points: [{ x: 160, y: 10 }, { x: 300, y: 90 }, { x: 160, y: 170 }, { x: 20, y: 90 }] };

  it('reads the calibration of a camera', async () => {
    const { fetch, calls } = fakeFetch([() => json(200, calibration)]);
    await expect(client(fetch).client.getCalibration('camera-1')).resolves.toEqual(calibration);
    expect(calls[0]?.url).toBe(`${url}/cameras/camera-1/calibration`);
  });

  it('gives null for a missing calibration', async () => {
    const { fetch } = fakeFetch([() => json(404, { error: 'not_found', message: 'Calibration of camera camera-1 not found' })]);
    await expect(client(fetch).client.getCalibration('camera-1')).resolves.toBeNull();
  });

  it('rejects another calibration error', async () => {
    const { fetch } = fakeFetch([() => json(403, { error: 'forbidden', message: 'Forbidden' })]);
    await expect(client(fetch).client.getCalibration('camera-1')).rejects.toThrow('HTTP 403 forbidden');
  });

  it('lists unfinished games', async () => {
    const { fetch, calls } = fakeFetch([() => json(200, [])]);
    await expect(client(fetch).client.listUnfinishedMatches()).resolves.toEqual([]);
    expect(calls[0]?.url).toBe(`${url}/matches?status=unfinished`);
  });

  it('rejects a malformed game list', async () => {
    const { fetch } = fakeFetch([() => json(200, [{ id: 'm_1' }])]);
    await expect(client(fetch).client.listUnfinishedMatches()).rejects.toThrow();
  });
});
