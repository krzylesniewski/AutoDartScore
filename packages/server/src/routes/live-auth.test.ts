import { LiveMessage } from '@autoscore/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToken } from '../auth/credentials.js';
import { S, createGame, createPlayers, hitEvent, setup, type TestApp } from '../test-helpers.js';
import { MATCH_NOT_FOUND_CLOSE_CODE, UNAUTHORIZED_CLOSE_CODE } from './live.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: (code: number) => void): void;
  on(event: 'ping', listener: () => void): void;
  send(data: string): void;
  terminate(): void;
}

interface Client {
  readonly messages: unknown[];
  pings: number;
  closeCode: number | null;
  readonly socket: TestSocket;
}

const auth = { password: 'tajne', tokenSecret: 's'.repeat(32) };
const now = Date.parse('2026-10-20T18:00:00.000Z');
const token = createToken(auth.tokenSecret, now + 60_000);
const front = 'https://front.example';

let t: TestApp | null = null;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t?.close();
  t = null;
});

async function start(options: Parameters<typeof setup>[0]): Promise<TestApp> {
  t = await setup({ now: () => now, ...options });
  return t;
}

async function createMatch(app: TestApp['app']): Promise<string> {
  const headers = { authorization: `Bearer ${token}` };
  const ids: string[] = [];
  for (const name of ['Anna', 'Bartek']) {
    const response = await app.inject({ method: 'POST', url: '/players', headers, payload: { name } });
    expect(response.statusCode).toBe(201);
    ids.push(response.json().id);
  }
  const response = await app.inject({ method: 'POST', url: '/matches', headers, payload: { type: 'match', playerIds: ids, startingScore: 301 } });
  expect(response.statusCode).toBe(201);
  return response.json().id;
}

async function connect(app: TestApp['app'], path: string, headers: Record<string, string> = {}): Promise<Client> {
  const client = { messages: [] as unknown[], pings: 0, closeCode: null as number | null };
  const socket: TestSocket = await app.injectWS(path, { headers }, {
    onInit(ws: TestSocket) {
      ws.on('message', (data) => client.messages.push(JSON.parse(data.toString())));
      ws.on('ping', () => client.pings++);
      ws.on('close', (code) => (client.closeCode = code));
    },
  });
  sockets.push(socket);
  return Object.assign(client, { socket });
}

async function closedWith(client: Client, code: number): Promise<void> {
  await vi.waitFor(() => expect(client.closeCode).toBe(code));
  expect(client.messages).toEqual([]);
}

async function firstMessage(client: Client): Promise<LiveMessage> {
  await vi.waitFor(() => expect(client.messages.length).toBeGreaterThanOrEqual(1));
  return LiveMessage.parse(client.messages[0]);
}

describe('live WebSocket with a password', () => {
  it('closes with 4401 when no auth message arrives in time', async () => {
    const { app } = await start({ auth, liveAuthTimeoutMs: 50 });
    const client = await connect(app, `/matches/${await createMatch(app)}/live`);
    await closedWith(client, UNAUTHORIZED_CLOSE_CODE);
  });

  it.each([
    ['invalid JSON', 'not json'],
    ['a non-auth message', JSON.stringify({ type: 'subscribe', token })],
    ['a bad token', JSON.stringify({ type: 'auth', token: `${token}x` })],
    ['an expired token', JSON.stringify({ type: 'auth', token: createToken(auth.tokenSecret, now) })],
  ])('closes with 4401 after %s', async (_name, message) => {
    const { app } = await start({ auth });
    const client = await connect(app, `/matches/${await createMatch(app)}/live`);
    client.socket.send(message);
    await closedWith(client, UNAUTHORIZED_CLOSE_CODE);
  });

  it('ignores a token in the query string', async () => {
    const { app } = await start({ auth, liveAuthTimeoutMs: 50 });
    const client = await connect(app, `/matches/${await createMatch(app)}/live?token=${encodeURIComponent(token)}`);
    await closedWith(client, UNAUTHORIZED_CLOSE_CODE);
  });

  it('sends state_updated first after a valid auth message and ignores later messages', async () => {
    const { app } = await start({ auth });
    const matchId = await createMatch(app);
    const client = await connect(app, `/matches/${matchId}/live`);
    client.socket.send(JSON.stringify({ type: 'auth', token }));
    expect(await firstMessage(client)).toMatchObject({ type: 'state_updated', matchId });

    client.socket.send('not json');
    client.socket.send(JSON.stringify({ type: 'auth', token: 'bad' }));
    const throwResponse = await app.inject({
      method: 'POST',
      url: `/matches/${matchId}/throws`,
      headers: { authorization: `Bearer ${token}` },
      payload: hitEvent(matchId, S(20)),
    });
    expect(throwResponse.statusCode).toBe(201);
    await vi.waitFor(() => expect(client.messages.length).toBeGreaterThanOrEqual(3));
    expect(client.closeCode).toBeNull();
  });

  it('closes with 4404 for an unknown match after a valid auth message', async () => {
    const { app } = await start({ auth });
    const client = await connect(app, '/matches/nope/live');
    client.socket.send(JSON.stringify({ type: 'auth', token }));
    await closedWith(client, MATCH_NOT_FOUND_CLOSE_CODE);
  });
});

describe('live WebSocket ping', () => {
  it('pings a connection with a password', async () => {
    const { app } = await start({ auth, livePingIntervalMs: 10 });
    const client = await connect(app, `/matches/${await createMatch(app)}/live`);
    client.socket.send(JSON.stringify({ type: 'auth', token }));
    await vi.waitFor(() => expect(client.pings).toBeGreaterThanOrEqual(2));
    expect(client.closeCode).toBeNull();
  });

  it('pings a connection without a password', async () => {
    const { app } = await start({ livePingIntervalMs: 10 });
    const [anna, bartek] = await createPlayers(app, 2);
    const { id } = await createGame(app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const client = await connect(app, `/matches/${id}/live`);
    await vi.waitFor(() => expect(client.pings).toBeGreaterThanOrEqual(2));
    expect(client.closeCode).toBeNull();
  });
});

describe('live WebSocket origin', () => {
  it('rejects a foreign origin with 403 before the upgrade', async () => {
    const { app } = await start({ corsOrigins: [front] });
    await expect(connect(app, '/matches/nope/live', { origin: 'https://evil.example' })).rejects.toThrow('Unexpected server response: 403');
  });

  it.each([
    ['an allowed origin', { origin: front }],
    ['no origin', {}],
  ])('connects with %s', async (_name, headers) => {
    const { app } = await start({ corsOrigins: [front] });
    const [anna, bartek] = await createPlayers(app, 2);
    const { id } = await createGame(app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const client = await connect(app, `/matches/${id}/live`, headers);
    expect(await firstMessage(client)).toMatchObject({ type: 'state_updated', matchId: id });
  });
});
