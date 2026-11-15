import { LiveMessage } from '@autoscore/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToken } from '../auth/credentials.js';
import { createGame, createPlayers, setup, type TestApp } from '../test-helpers.js';
import { LIVE_MAX_PAYLOAD_BYTES, TOO_MANY_CONNECTIONS_CLOSE_CODE, UNAUTHORIZED_CLOSE_CODE } from './live.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: (code: number) => void): void;
  on(event: 'ping', listener: (data: Buffer) => void): void;
  send(data: string): void;
  pong(data: Buffer): void;
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

// Klient injectWS sam nie odpowiada na ping, więc odpowiedź trzeba włączyć jawnie.
async function connect(app: TestApp['app'], path: string, { pong = true } = {}): Promise<Client> {
  const client = { messages: [] as unknown[], pings: 0, closeCode: null as number | null };
  const socket: TestSocket = await app.injectWS(path, {}, {
    onInit(ws: TestSocket) {
      ws.on('message', (data) => client.messages.push(JSON.parse(data.toString())));
      if (pong) {
        ws.on('ping', (data) => ws.pong(data));
      }
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

async function authenticate(client: Client, matchId: string): Promise<void> {
  client.socket.send(JSON.stringify({ type: 'auth', token }));
  expect(await firstMessage(client)).toMatchObject({ type: 'state_updated', matchId });
}

describe('live WebSocket message size', () => {
  it('closes with 1009 on a valid auth message larger than LIVE_MAX_PAYLOAD_BYTES', async () => {
    const { app } = await start({ auth });
    const client = await connect(app, `/matches/${await createMatch(app)}/live`);
    client.socket.send(JSON.stringify({ type: 'auth', token, padding: 'x'.repeat(LIVE_MAX_PAYLOAD_BYTES) }));
    await closedWith(client, 1009);
  });

  it('accepts a padded auth message below the limit', async () => {
    const { app } = await start({ auth });
    const matchId = await createMatch(app);
    const client = await connect(app, `/matches/${matchId}/live`);
    client.socket.send(JSON.stringify({ type: 'auth', token, padding: 'x'.repeat(1000) }));
    expect(await firstMessage(client)).toMatchObject({ type: 'state_updated', matchId });
  });
});

describe('live WebSocket pending connections', () => {
  it('closes a connection past the limit with 4429 and frees a slot after auth', async () => {
    const { app } = await start({ auth, liveMaxPendingConnections: 2 });
    const matchId = await createMatch(app);
    const path = `/matches/${matchId}/live`;
    const first = await connect(app, path);
    await connect(app, path);

    await closedWith(await connect(app, path), TOO_MANY_CONNECTIONS_CLOSE_CODE);

    await authenticate(first, matchId);
    const next = await connect(app, path);
    await authenticate(next, matchId);
    expect(next.closeCode).toBeNull();
  });

  it('frees a slot after the auth timeout', async () => {
    const { app } = await start({ auth, liveMaxPendingConnections: 1, liveAuthTimeoutMs: 50 });
    const matchId = await createMatch(app);
    const path = `/matches/${matchId}/live`;
    const stale = await connect(app, path);
    await closedWith(await connect(app, path), TOO_MANY_CONNECTIONS_CLOSE_CODE);

    await closedWith(stale, UNAUTHORIZED_CLOSE_CODE);
    const next = await connect(app, path);
    await authenticate(next, matchId);
    expect(next.closeCode).toBeNull();
  });

  it('does not limit connections without a password', async () => {
    const { app } = await start({ liveMaxPendingConnections: 2 });
    const [anna, bartek] = await createPlayers(app, 2);
    const { id } = await createGame(app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const clients: Client[] = [];
    for (let i = 0; i < 4; i++) {
      clients.push(await connect(app, `/matches/${id}/live`));
    }
    for (const client of clients) {
      expect(await firstMessage(client)).toMatchObject({ type: 'state_updated', matchId: id });
      expect(client.closeCode).toBeNull();
    }
  });
});

describe('live WebSocket liveness', () => {
  it('terminates a subscribed connection that does not answer pings', async () => {
    const { app } = await start({ livePingIntervalMs: 10 });
    const [anna, bartek] = await createPlayers(app, 2);
    const { id } = await createGame(app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const client = await connect(app, `/matches/${id}/live`, { pong: false });
    expect(await firstMessage(client)).toMatchObject({ type: 'state_updated', matchId: id });
    // 1006: połączenie zerwane bez ramki zamknięcia, czyli przez terminate().
    await vi.waitFor(() => expect(client.closeCode).toBe(1006));
  });

  it('keeps a connection that answers pings', async () => {
    const { app } = await start({ auth, livePingIntervalMs: 10 });
    const matchId = await createMatch(app);
    const client = await connect(app, `/matches/${matchId}/live`);
    await authenticate(client, matchId);
    await vi.waitFor(() => expect(client.pings).toBeGreaterThanOrEqual(5));
    expect(client.closeCode).toBeNull();
  });
});
