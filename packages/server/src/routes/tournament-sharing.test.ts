import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, TournamentLiveMessage, TournamentStaleStateError, TournamentView } from '@autoscore/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  countRows,
  createPlayers,
  createTournament,
  getTournament,
  playFixture,
  setSharing,
  setup,
  type TestApp,
} from '../test-helpers.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

let t: TestApp | null = null;
let dir: string | null = null;
const sockets: TestSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t?.close();
  t = null;
  if (dir !== null) {
    await rm(dir, { recursive: true, force: true });
    dir = null;
  }
});

async function start(options: Parameters<typeof setup>[0] = {}): Promise<TestApp> {
  t = await setup(options);
  return t;
}

function league(app: TestApp['app'], playerIds: readonly string[]) {
  return createTournament(app, { name: 'Liga testowa', format: 'league', playerIds });
}

// Puchar 3 graczy: p-sf-1 to wolny los, więc wystarczą p-sf-2 i finał.
async function finishedCup(app: TestApp['app']): Promise<TournamentView> {
  const cup = await createTournament(app, { name: 'Puchar testowy', format: 'cup', playerIds: await createPlayers(app, 3) });
  await playFixture(app, cup.id, 'p-sf-2');
  const { tournament } = await playFixture(app, cup.id, 'p-f');
  expect(tournament.status).toBe('finished');
  return tournament;
}

function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, error: string): void {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(error);
}

// Nasłuch w onInit, bo pierwsza wiadomość może przyjść przed rozwiązaniem injectWS.
async function subscribe(app: TestApp['app'], tournamentId: string): Promise<unknown[]> {
  const messages: unknown[] = [];
  const socket: TestSocket = await app.injectWS(
    `/tournaments/${tournamentId}/live`,
    {},
    {
      onInit(ws: TestSocket) {
        ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      },
    },
  );
  sockets.push(socket);
  return messages;
}

describe('POST /tournaments/:id/sharing', () => {
  it('switches sharing, writes sharing_changed and sends tournament_updated', async () => {
    const { app, db } = await start();
    const created = await league(app, await createPlayers(app, 3));
    expect(created).toMatchObject({ sharing: true, eventSeq: 1 });
    const messages = await subscribe(app, created.id);
    await vi.waitFor(() => expect(messages).toHaveLength(1));

    const response = await setSharing(app, created.id, { sharing: false, expectedSeq: 1 });
    expect(response.statusCode).toBe(200);
    const view = TournamentView.parse(response.json());
    expect(view).toMatchObject({ sharing: false, eventSeq: 2 });
    expect(view.config.sharing).toBe(true);
    expect(await getTournament(app, created.id)).toEqual(view);
    expect(await countRows(db, 'tournament_events')).toBe(2);

    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(TournamentLiveMessage.parse(messages[1])).toEqual({
      type: 'tournament_updated',
      tournamentId: created.id,
      eventSeq: 2,
      tournament: view,
    });

    const back = await setSharing(app, created.id, { sharing: true });
    expect(back.statusCode).toBe(200);
    expect(TournamentView.parse(back.json())).toMatchObject({ sharing: true, eventSeq: 3 });
  });

  it('writes nothing when the value does not change', async () => {
    const { app, db } = await start();
    const created = await league(app, await createPlayers(app, 3));
    const response = await setSharing(app, created.id, { sharing: true, expectedSeq: 1 });
    expect(response.statusCode).toBe(200);
    expect(TournamentView.parse(response.json())).toEqual(created);
    expect(await countRows(db, 'tournament_events')).toBe(1);
  });

  it('rejects a stale expectedSeq with the current view', async () => {
    const { app, db } = await start();
    const created = await league(app, await createPlayers(app, 3));
    const response = await setSharing(app, created.id, { sharing: false, expectedSeq: 7 });
    expectError(response, 409, 'stale_state');
    expect(TournamentStaleStateError.parse(response.json()).tournament).toEqual(created);
    expect(await countRows(db, 'tournament_events')).toBe(1);
  });

  it('works in a finished tournament and refuses an archived one', async () => {
    const { app } = await start();
    const cup = await finishedCup(app);
    const response = await setSharing(app, cup.id, { sharing: false });
    expect(response.statusCode).toBe(200);
    expect(TournamentView.parse(response.json())).toMatchObject({ status: 'finished', sharing: false, eventSeq: cup.eventSeq + 1 });

    expect((await app.inject({ method: 'POST', url: `/tournaments/${cup.id}/archive` })).statusCode).toBe(200);
    expectError(await setSharing(app, cup.id, { sharing: true }), 409, 'tournament_archived');
  });

  it.each([
    ['no body', undefined],
    ['no sharing', { expectedSeq: 1 }],
    ['a string', { sharing: 'false' }],
    ['a number', { sharing: 0 }],
  ])('rejects %s with 400', async (_name, payload) => {
    const { app, db } = await start();
    const created = await league(app, await createPlayers(app, 3));
    expectError(await setSharing(app, created.id, payload), 400, 'invalid_request');
    expect(await countRows(db, 'tournament_events')).toBe(1);
  });

  it('gives 404 for an unknown tournament', async () => {
    const { app } = await start();
    expectError(await setSharing(app, 't_nope', { sharing: false }), 404, 'not_found');
  });

  it('keeps the switched value after a restart on the same database file', async () => {
    dir = await mkdtemp(join(tmpdir(), 'autoscore-'));
    const path = join(dir, 'games.sqlite');
    const first = await start({ path });
    const created = await league(first.app, await createPlayers(first.app, 3));
    expect((await setSharing(first.app, created.id, { sharing: false })).statusCode).toBe(200);
    const before = await getTournament(first.app, created.id);
    await first.close();
    t = null;

    const second = await start({ path });
    const after = await getTournament(second.app, created.id);
    expect(after).toEqual(before);
    expect(after).toMatchObject({ sharing: false, eventSeq: 2 });
  });
});
