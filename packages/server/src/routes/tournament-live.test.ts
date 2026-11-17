import { StartFixtureResult, TournamentLiveMessage, type Player } from '@autoscore/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createToken } from '../auth/credentials.js';
import {
  LEG_301,
  createPlayers,
  createTournament,
  fixtureOf,
  getTournament,
  setup,
  startFixture,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';
import { MATCH_NOT_FOUND_CLOSE_CODE, UNAUTHORIZED_CLOSE_CODE } from './live.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: (code: number) => void): void;
  send(data: string): void;
  terminate(): void;
}

interface Subscriber {
  readonly messages: unknown[];
  closeCode: number | null;
  readonly socket: TestSocket;
}

let t: TestApp | null = null;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t?.close();
  t = null;
});

async function start(options: Parameters<typeof setup>[0] = {}): Promise<TestApp> {
  t = await setup(options);
  return t;
}

// Nasłuch w onInit, bo pierwsza wiadomość może przyjść przed rozwiązaniem injectWS.
async function subscribe(app: TestApp['app'], tournamentId: string): Promise<Subscriber> {
  const subscriber = { messages: [] as unknown[], closeCode: null as number | null };
  const socket: TestSocket = await app.injectWS(
    `/tournaments/${tournamentId}/live`,
    {},
    {
      onInit(ws: TestSocket) {
        ws.on('message', (data) => subscriber.messages.push(JSON.parse(data.toString())));
        ws.on('close', (code) => (subscriber.closeCode = code));
      },
    },
  );
  sockets.push(socket);
  return Object.assign(subscriber, { socket });
}

async function received(subscriber: Subscriber, count: number): Promise<TournamentLiveMessage[]> {
  await vi.waitFor(() => expect(subscriber.messages.length).toBeGreaterThanOrEqual(count));
  return subscriber.messages.map((message) => TournamentLiveMessage.parse(message));
}

describe('GET /tournaments/:id/live', () => {
  it('sends the current view on connect', async () => {
    const { app } = await start();
    const created = await createTournament(app, { name: 'Liga testowa', format: 'league', playerIds: await createPlayers(app, 3) });
    const subscriber = await subscribe(app, created.id);
    const [first] = await received(subscriber, 1);
    expect(first).toEqual({ type: 'tournament_updated', tournamentId: created.id, eventSeq: 1, tournament: created });
  });

  it('sends the view after a start, a leg-winning throw and its undo', async () => {
    const { app } = await start();
    const created = await createTournament(app, { name: 'Liga testowa', format: 'league', playerIds: await createPlayers(app, 3) });
    const subscriber = await subscribe(app, created.id);
    await received(subscriber, 1);

    const { matchId } = StartFixtureResult.parse((await startFixture(app, created.id, 'g-1')).json());
    const [, started] = await received(subscriber, 2);
    expect(started).toMatchObject({ eventSeq: 2, tournament: { liveFixtureId: 'g-1' } });
    expect(fixtureOf(started?.tournament ?? created, 'g-1')).toMatchObject({ status: 'in_progress', matchId });

    // Rzutki bez wygranego lega nie zmieniają turnieju.
    await throwDarts(app, matchId, LEG_301.slice(0, -1));
    expect(subscriber.messages).toHaveLength(2);
    await throwDarts(app, matchId, LEG_301.slice(-1));
    const [, , won] = await received(subscriber, 3);
    expect(won).toMatchObject({ type: 'tournament_updated', tournamentId: created.id, eventSeq: 2 });
    expect(fixtureOf(won?.tournament ?? created, 'g-1')).toMatchObject({ status: 'finished', result: { legs: [1, 0] } });
    expect(won?.tournament).toEqual(await getTournament(app, created.id));

    expect((await undo(app, matchId)).statusCode).toBe(200);
    const [, , , undone] = await received(subscriber, 4);
    expect(fixtureOf(undone?.tournament ?? created, 'g-1')).toMatchObject({ status: 'in_progress', result: null });
    expect(undone?.tournament.standings.every((row) => row.played === 0)).toBe(true);

    // Kolejne cofnięcie nie zmienia legów.
    expect((await undo(app, matchId)).statusCode).toBe(200);
    expect(subscriber.messages).toHaveLength(4);
  });

  it('closes with 4404 for an unknown tournament', async () => {
    const { app } = await start();
    const subscriber = await subscribe(app, 't_nope');
    await vi.waitFor(() => expect(subscriber.closeCode).toBe(MATCH_NOT_FOUND_CLOSE_CODE));
    expect(subscriber.messages).toEqual([]);
  });

  it('needs the auth message first when the password is on', async () => {
    const auth = { password: 'tajne', tokenSecret: 's'.repeat(32) };
    const now = Date.parse('2026-11-17T18:00:00.000Z');
    const token = createToken(auth, now + 60_000);
    const { app } = await start({ auth, now: () => now });
    const headers = { authorization: `Bearer ${token}` };
    const playerIds: string[] = [];
    for (const name of ['Anna', 'Bartek', 'Celina']) {
      const response = await app.inject({ method: 'POST', url: '/players', headers, payload: { name } });
      playerIds.push(response.json<Player>().id);
    }
    const unauthorized = await app.inject({
      method: 'POST',
      url: '/tournaments',
      payload: { name: 'Liga testowa', format: 'league', playerIds },
    });
    expect(unauthorized.statusCode).toBe(401);
    const created = await app.inject({
      method: 'POST',
      url: '/tournaments',
      headers,
      payload: { name: 'Liga testowa', format: 'league', playerIds },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json<{ id: string }>().id;

    const rejected = await subscribe(app, id);
    rejected.socket.send(JSON.stringify({ type: 'auth', token: 'zły' }));
    await vi.waitFor(() => expect(rejected.closeCode).toBe(UNAUTHORIZED_CLOSE_CODE));
    expect(rejected.messages).toEqual([]);

    const accepted = await subscribe(app, id);
    expect(accepted.messages).toEqual([]);
    accepted.socket.send(JSON.stringify({ type: 'auth', token }));
    const [first] = await received(accepted, 1);
    expect(first).toMatchObject({ type: 'tournament_updated', tournamentId: id, eventSeq: 1 });
  });
});
