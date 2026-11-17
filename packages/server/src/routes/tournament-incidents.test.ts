import {
  ApiError,
  LiveMessage,
  StartFixtureResult,
  TournamentLiveMessage,
  TournamentStaleStateError,
  TournamentView,
} from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLiveHub } from '../live-hub.js';
import { createReplayCache } from '../replay-cache.js';
import { createSerialQueue, type SerialQueue } from '../serial-queue.js';
import { createStore } from '../store/store.js';
import {
  D,
  LEG_301,
  MISS,
  S,
  abandon,
  correctResult,
  countRows,
  createPlayers,
  createTournament,
  fixtureOf,
  getMatch,
  getTournament,
  hitEvent,
  logEntries,
  playFixture,
  postThrow,
  resume,
  setup,
  slotPlayers,
  startFixture,
  throwDarts,
  undo,
  withdraw,
  type TestApp,
} from '../test-helpers.js';
import { createTournamentService } from '../tournament-service.js';

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

let t: TestApp;
const sockets: TestSocket[] = [];
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  for (const socket of sockets.splice(0)) {
    socket.terminate();
  }
  await t.close();
});

function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, error: string): void {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(error);
}

function viewOf(response: { statusCode: number; json(): unknown }, statusCode: number): TournamentView {
  expect(response.statusCode).toBe(statusCode);
  return TournamentView.parse(response.json());
}

// Z random 0 losowanie daje mecze g-1 Bartek–Anna, g-2 Celina–Darek, g-3 Bartek–Darek, g-4 Celina–Anna,
// g-5 Bartek–Celina, g-6 Darek–Anna. Gracz ze slotu 0 wygrywa każdy mecz z playFixture.
async function fourPlayers() {
  const [anna, bartek, celina, darek] = (await createPlayers(t.app, 4)) as [string, string, string, string];
  return { anna, bartek, celina, darek };
}

function league(playerIds: readonly string[], extra: object = {}) {
  return createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds, ...extra });
}

// Tabela grupy po wszystkich meczach: Bartek, Celina, Darek, Anna. Finał Bartek–Celina.
async function playedGroup(): Promise<{ view: TournamentView; lastMatchId: string; players: Awaited<ReturnType<typeof fourPlayers>> }> {
  const players = await fourPlayers();
  const { anna, bartek, celina, darek } = players;
  let view = await createTournament(t.app, {
    name: 'Grupa testowa',
    format: 'group_playoff',
    playerIds: [anna, bartek, celina, darek],
    advance: 2,
  });
  let lastMatchId = '';
  while (view.nextFixtureId?.startsWith('g-')) {
    const played = await playFixture(t.app, view.id, view.nextFixtureId);
    view = played.tournament;
    lastMatchId = played.matchId;
  }
  return { view, lastMatchId, players };
}

async function started(tournamentId: string, fixtureId: string): Promise<string> {
  const response = await startFixture(t.app, tournamentId, fixtureId);
  expect(response.statusCode).toBe(201);
  return StartFixtureResult.parse(response.json()).matchId;
}

// Puchar 3 graczy: p-sf-1 to wolny los, więc wystarczą p-sf-2 i finał.
async function finishedCup(): Promise<TournamentView> {
  const players = await createPlayers(t.app, 3);
  const cup = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
  await playFixture(t.app, cup.id, 'p-sf-2');
  const { tournament } = await playFixture(t.app, cup.id, 'p-f');
  expect(tournament.status).toBe('finished');
  return tournament;
}

async function rowCounts() {
  return {
    throws: await countRows(t.db, 'throws'),
    matchEvents: await countRows(t.db, 'match_events'),
    tournamentEvents: await countRows(t.db, 'tournament_events'),
  };
}

describe('POST /tournaments/:id/withdrawals', () => {
  it('turns the remaining league fixtures into walkovers and keeps the played ones', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek], { legsToWin: { group: 2 } });
    // Drugi leg zaczyna gracz ze slotu 1, więc trzy pudła oddają wygraną graczowi ze slotu 0.
    for (const fixtureId of ['g-1', 'g-2']) {
      const matchId = await started(created.id, fixtureId);
      await throwDarts(t.app, matchId, [...LEG_301, MISS, MISS, MISS, ...LEG_301]);
    }

    const view = viewOf(await withdraw(t.app, created.id, { playerId: darek }), 201);
    expect(view.eventSeq).toBe(created.eventSeq + 3);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'finished', result: { legs: [2, 0], winnerId: bartek, corrected: false } });
    expect(fixtureOf(view, 'g-2')).toMatchObject({ status: 'finished', result: { legs: [2, 0], winnerId: celina, corrected: false } });
    expect(fixtureOf(view, 'g-3')).toMatchObject({ status: 'walkover', matchId: null, result: { legs: [2, 0], winnerId: bartek } });
    expect(fixtureOf(view, 'g-6')).toMatchObject({ status: 'walkover', matchId: null, result: { legs: [0, 2], winnerId: anna } });
    expect(view.fixtures.filter((fixture) => fixture.status === 'ready').map((fixture) => fixture.id)).toEqual(['g-4', 'g-5']);
    const rows = new Map(view.standings.map((row) => [row.playerId, row]));
    expect(rows.get(darek)).toMatchObject({ withdrawn: true });
    expect(rows.get(celina)).toMatchObject({ withdrawn: false });
    expect(await getTournament(t.app, created.id)).toEqual(view);
  });

  it('abandons the fixture match in progress, which then takes no throw and cannot be resumed', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    const matchId = await started(created.id, 'g-1');
    await throwDarts(t.app, matchId, [S(20)]);

    const view = viewOf(await withdraw(t.app, created.id, { playerId: anna }), 201);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'walkover', matchId, result: { legs: [1, 0], winnerId: bartek } });
    expect(view.liveFixtureId).toBeNull();
    const match = await getMatch(t.app, matchId);
    expect(match.abandonment).toMatchObject({ playerId: anna, reason: null });
    expect((await logEntries(t.db, matchId)).map((entry) => [entry.type, entry.player_id])).toEqual([
      ['throw', null],
      ['match_abandoned', anna],
    ]);

    const before = await rowCounts();
    expectError(await postThrow(t.app, matchId, hitEvent(matchId, S(20))), 409, 'match_abandoned');
    expectError(await resume(t.app, matchId), 409, 'player_withdrawn');
    expect(await rowCounts()).toEqual(before);
    expect((await getMatch(t.app, matchId)).abandonment).toMatchObject({ playerId: anna });
  });

  it('does not abandon a fixture match twice', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    const matchId = await started(created.id, 'g-1');
    expect((await abandon(t.app, matchId, { playerId: bartek })).statusCode).toBe(200);

    const view = viewOf(await withdraw(t.app, created.id, { playerId: anna }), 201);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'walkover', matchId });
    expect((await logEntries(t.db, matchId)).map((entry) => [entry.type, entry.player_id])).toEqual([['match_abandoned', bartek]]);
    expect((await getMatch(t.app, matchId)).abandonment).toMatchObject({ playerId: bartek });
    expect(await getTournament(t.app, created.id)).toEqual(view);
  });

  it('moves the opponent of a withdrawn semifinalist into the cup final', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const cup = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: [anna, bartek, celina, darek] });
    expect(slotPlayers(fixtureOf(cup, 'p-sf-1'))).toEqual([bartek, anna]);

    const view = viewOf(await withdraw(t.app, cup.id, { playerId: anna }), 201);
    expect(fixtureOf(view, 'p-sf-1')).toMatchObject({ status: 'walkover', result: { legs: [1, 0], winnerId: bartek } });
    expect(fixtureOf(view, 'p-f')).toMatchObject({
      status: 'waiting',
      slots: [{ kind: 'player', playerId: bartek }, { kind: 'winner_of' }],
    });

    const { tournament, winnerId } = await playFixture(t.app, cup.id, 'p-sf-2');
    expect(winnerId).toBe(celina);
    expect(fixtureOf(tournament, 'p-f')).toMatchObject({
      status: 'ready',
      slots: [
        { kind: 'player', playerId: bartek },
        { kind: 'player', playerId: celina },
      ],
    });
  });

  it('rejects unknown tournaments, outsiders, repeats, finished, archived and stale tournaments and bad bodies', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina]);
    const before = await rowCounts();

    expectError(await withdraw(t.app, 't_nope', { playerId: anna }), 404, 'not_found');
    expectError(await withdraw(t.app, created.id, { playerId: darek }), 400, 'not_a_participant');
    expectError(await withdraw(t.app, created.id), 400, 'invalid_request');
    expectError(await withdraw(t.app, created.id, {}), 400, 'invalid_request');
    expectError(await withdraw(t.app, created.id, { playerId: anna, expectedSeq: -1 }), 400, 'invalid_request');
    const stale = await withdraw(t.app, created.id, { playerId: anna, expectedSeq: created.eventSeq + 1 });
    expectError(stale, 409, 'stale_state');
    expect(TournamentStaleStateError.parse(stale.json()).tournament).toEqual(created);
    expect(await rowCounts()).toEqual(before);

    viewOf(await withdraw(t.app, created.id, { playerId: anna, expectedSeq: created.eventSeq }), 201);
    expectError(await withdraw(t.app, created.id, { playerId: anna }), 409, 'already_withdrawn');
  });

  it('rejects a withdrawal from a finished and from an archived tournament', async () => {
    const cup = await finishedCup();
    const [player] = cup.config.playerIds;
    expectError(await withdraw(t.app, cup.id, { playerId: player }), 409, 'tournament_finished');
    expect((await t.app.inject({ method: 'POST', url: `/tournaments/${cup.id}/archive` })).statusCode).toBe(200);
    expectError(await withdraw(t.app, cup.id, { playerId: player }), 409, 'tournament_archived');
  });
});

describe('POST /tournaments/:id/fixtures/:fixtureId/result', () => {
  it('corrects a group fixture before the play-off, and the last correction wins', async () => {
    const { view: played, players } = await playedGroup();
    const { bartek, celina, darek } = players;
    const throwsBefore = await countRows(t.db, 'throws');
    expect(played.standings.map((row) => row.playerId).slice(0, 3)).toEqual([bartek, celina, darek]);

    const corrected = viewOf(await correctResult(t.app, played.id, 'g-2', { legs: [0, 1] }), 200);
    expect(corrected.eventSeq).toBe(played.eventSeq + 1);
    expect(fixtureOf(corrected, 'g-2')).toMatchObject({ status: 'finished', result: { legs: [0, 1], winnerId: darek, corrected: true } });
    expect(corrected.standings.map((row) => row.playerId).slice(0, 3)).toEqual([bartek, darek, celina]);
    expect(fixtureOf(corrected, 'p-f').slots).toMatchObject([
      { kind: 'player', playerId: bartek },
      { kind: 'player', playerId: darek },
    ]);
    expect(await getTournament(t.app, played.id)).toEqual(corrected);

    const again = viewOf(await correctResult(t.app, played.id, 'g-2', { legs: [1, 0], expectedSeq: corrected.eventSeq }), 200);
    expect(fixtureOf(again, 'g-2')).toMatchObject({ result: { legs: [1, 0], winnerId: celina, corrected: true } });
    expect(again.standings.map((row) => row.playerId).slice(0, 3)).toEqual([bartek, celina, darek]);
    expect(fixtureOf(again, 'p-f').slots).toMatchObject([
      { kind: 'player', playerId: bartek },
      { kind: 'player', playerId: celina },
    ]);
    expect(await countRows(t.db, 'throws')).toBe(throwsBefore);
  });

  it('swaps the first two places when the final of a finished cup is corrected', async () => {
    const cup = await finishedCup();
    const final = fixtureOf(cup, 'p-f');
    const first = cup.placements.find((placement) => placement.place === 1)?.playerId;
    const second = cup.placements.find((placement) => placement.place === 2)?.playerId;
    expect(final.result?.legs).toEqual([1, 0]);

    const view = viewOf(await correctResult(t.app, cup.id, 'p-f', { legs: [0, 1] }), 200);
    expect(view.status).toBe('finished');
    expect(fixtureOf(view, 'p-f').result).toMatchObject({ winnerId: second, corrected: true });
    expect(view.placements).toContainEqual({ playerId: second, place: 1 });
    expect(view.placements).toContainEqual({ playerId: first, place: 2 });
  });

  it('rejects unknown, unfinished and dependent-locked fixtures, wrong legs, stale and archived tournaments and bad bodies', async () => {
    const { view: played } = await playedGroup();
    const before = await rowCounts();

    expectError(await correctResult(t.app, 't_nope', 'g-1', { legs: [0, 1] }), 404, 'not_found');
    expectError(await correctResult(t.app, played.id, 'g-99', { legs: [0, 1] }), 404, 'not_found');
    expectError(await correctResult(t.app, played.id, 'p-f', { legs: [0, 1] }), 409, 'fixture_not_finished');
    expectError(await correctResult(t.app, played.id, 'g-1', { legs: [2, 0] }), 400, 'invalid_result');
    expectError(await correctResult(t.app, played.id, 'g-1', { legs: [0, 3] }), 400, 'invalid_result');
    expectError(await correctResult(t.app, played.id, 'g-1'), 400, 'invalid_request');
    expectError(await correctResult(t.app, played.id, 'g-1', {}), 400, 'invalid_request');
    expectError(await correctResult(t.app, played.id, 'g-1', { legs: [1, 1] }), 400, 'invalid_request');
    const stale = await correctResult(t.app, played.id, 'g-1', { legs: [0, 1], expectedSeq: played.eventSeq - 1 });
    expectError(stale, 409, 'stale_state');
    expect(TournamentStaleStateError.parse(stale.json()).tournament).toEqual(played);
    expect(await rowCounts()).toEqual(before);

    await started(played.id, 'p-f');
    expectError(await correctResult(t.app, played.id, 'p-f', { legs: [0, 1] }), 409, 'fixture_not_finished');
    expectError(await correctResult(t.app, played.id, 'g-1', { legs: [0, 1] }), 409, 'dependent_started');
  });

  it('rejects a correction of a walkover', async () => {
    const { anna, bartek, celina } = await fourPlayers();
    const created = await league([anna, bartek, celina]);
    const view = viewOf(await withdraw(t.app, created.id, { playerId: anna }), 201);
    const walkover = view.fixtures.find((fixture) => fixture.status === 'walkover');
    expect(walkover).toBeDefined();
    expectError(await correctResult(t.app, created.id, walkover?.id ?? '', { legs: [0, 1] }), 409, 'fixture_not_finished');
  });

  it('rejects a correction in an archived tournament', async () => {
    const cup = await finishedCup();
    expect((await t.app.inject({ method: 'POST', url: `/tournaments/${cup.id}/archive` })).statusCode).toBe(200);
    expectError(await correctResult(t.app, cup.id, 'p-f', { legs: [0, 1] }), 409, 'tournament_archived');
  });
});

describe('undo lock in a tournament', () => {
  it('undoes the group-deciding dart until the play-off starts, then locks it', async () => {
    const { view: played, lastMatchId } = await playedGroup();
    expect(fixtureOf(played, 'p-f').status).toBe('ready');

    const undone = await undo(t.app, lastMatchId);
    expect(undone.statusCode).toBe(200);
    expectError(await startFixture(t.app, played.id, 'p-f'), 409, 'fixture_not_ready');
    let view = await getTournament(t.app, played.id);
    expect(fixtureOf(view, 'g-6')).toMatchObject({ status: 'in_progress', result: null });
    expect(fixtureOf(view, 'p-f')).toMatchObject({
      status: 'waiting',
      slots: [
        { kind: 'standing', place: 1 },
        { kind: 'standing', place: 2 },
      ],
    });

    await throwDarts(t.app, lastMatchId, [D(5)]);
    view = await getTournament(t.app, played.id);
    expect(fixtureOf(view, 'g-6').status).toBe('finished');
    await started(played.id, 'p-f');
    const events = await countRows(t.db, 'match_events');
    expectError(await undo(t.app, lastMatchId), 409, 'match_locked');
    expect(await countRows(t.db, 'match_events')).toBe(events);
    expect((await getMatch(t.app, lastMatchId)).status).toBe('finished');
  });

  it('undoes the winning dart of a league fixture while another fixture is in progress', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    const { matchId } = await playFixture(t.app, created.id, 'g-1');
    await started(created.id, 'g-2');

    expect((await undo(t.app, matchId)).statusCode).toBe(200);
    const view = await getTournament(t.app, created.id);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'in_progress', result: null });
    expect(fixtureOf(view, 'g-2').status).toBe('in_progress');
  });
});

describe('races', () => {
  // Obie kolejności wysłania, bo to, która komenda pierwsza weźmie klucz, zależy od kolejności żądań.
  it.each(['undo', 'start'])(
    'lets either the undo of the group-deciding dart or the start of the final win (%s sent first)',
    async (first) => {
      const { view: played, lastMatchId } = await playedGroup();

      const sendUndo = () => undo(t.app, lastMatchId);
      const sendStart = () => startFixture(t.app, played.id, 'p-f');
      const [undone, start] =
        first === 'undo' ? await Promise.all([sendUndo(), sendStart()]) : (await Promise.all([sendStart(), sendUndo()])).reverse();
      if (undone === undefined || start === undefined) {
        throw new Error('Both responses are expected');
      }
      const outcome = [undone.statusCode, start.statusCode];
      if (undone.statusCode === 200) {
        expectError(start, 409, 'fixture_not_ready');
        expect(fixtureOf(await getTournament(t.app, played.id), 'g-6').status).toBe('in_progress');
      } else {
        expect(outcome).toEqual([409, 201]);
        expectError(undone, 409, 'match_locked');
        expect(fixtureOf(await getTournament(t.app, played.id), 'p-f').status).toBe('in_progress');
      }
      expect((await t.app.inject({ method: 'GET', url: `/tournaments/${played.id}` })).statusCode).toBe(200);
    },
  );

  it.each(['withdrawal', 'throw'])('lets either the withdrawal or the match-winning throw come first (%s sent first)', async (first) => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    const matchId = await started(created.id, 'g-1');
    await throwDarts(t.app, matchId, LEG_301.slice(0, -1));

    const sendWithdrawal = () => withdraw(t.app, created.id, { playerId: anna });
    const sendThrow = () => postThrow(t.app, matchId, hitEvent(matchId, D(5)));
    const [withdrawn, thrown] =
      first === 'withdrawal'
        ? await Promise.all([sendWithdrawal(), sendThrow()])
        : (await Promise.all([sendThrow(), sendWithdrawal()])).reverse();
    if (withdrawn === undefined || thrown === undefined) {
      throw new Error('Both responses are expected');
    }
    expect(withdrawn.statusCode).toBe(201);
    const entries = await logEntries(t.db, matchId);
    const fixture = fixtureOf(await getTournament(t.app, created.id), 'g-1');
    if (thrown.statusCode === 201) {
      expect(fixture).toMatchObject({ status: 'finished', matchId, result: { legs: [1, 0], winnerId: bartek } });
      expect(entries.some((entry) => entry.type === 'match_abandoned')).toBe(false);
      expect((await getMatch(t.app, matchId)).abandonment).toBeNull();
    } else {
      expectError(thrown, 409, 'match_abandoned');
      expect(fixture).toMatchObject({ status: 'walkover', matchId, result: { legs: [1, 0], winnerId: bartek } });
      const abandonedAt = entries.findIndex((entry) => entry.type === 'match_abandoned');
      expect(abandonedAt).toBe(entries.length - 1);
      expect(entries.slice(abandonedAt).some((entry) => entry.type === 'throw')).toBe(false);
    }
    expect((await t.app.inject({ method: 'GET', url: `/matches/${matchId}` })).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: `/tournaments/${created.id}` })).statusCode).toBe(200);
  });
});

describe('withdrawal retry', () => {
  // Drugi serwis turniejów na tej samej bazie, z kolejką, która przed pierwszym wzięciem klucza `gate` wykonuje `before`.
  // Tak zmiana trafia dokładnie między odczyt bez kluczy a sprawdzenie pod kluczami.
  function gatedService(gate: string, before: () => Promise<void>) {
    const store = createStore(t.db);
    const shared = createSerialQueue();
    const taken: string[] = [];
    let pending: (() => Promise<void>) | null = before;
    const queue: SerialQueue = (key, task) => {
      taken.push(key);
      const run = key === gate ? pending : null;
      if (run === null) {
        return shared(key, task);
      }
      pending = null;
      return run().then(() => shared(key, task));
    };
    const service = createTournamentService({
      store,
      cache: createReplayCache({ store, log: { warn: () => undefined }, maxEntries: 0 }),
      hub: createLiveHub<TournamentLiveMessage>(),
      queue,
      random: () => 0,
    });
    return { service, taken };
  }

  it('starts again without the match when it finishes before its key is taken', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    const matchId = await started(created.id, 'g-1');
    await throwDarts(t.app, matchId, LEG_301.slice(0, -1));
    const { service, taken } = gatedService(matchId, async () => {
      await throwDarts(t.app, matchId, [D(5)]);
    });

    const view = await service.withdraw(created.id, { playerId: anna });
    expect(taken).toEqual([matchId, `tournament:${created.id}`, `tournament:${created.id}`]);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'finished', matchId, result: { legs: [1, 0], winnerId: bartek } });
    expect((await logEntries(t.db, matchId)).some((entry) => entry.type === 'match_abandoned')).toBe(false);
    expect(fixtureOf(view, 'g-4')).toMatchObject({ status: 'walkover', result: { winnerId: celina } });
  });

  it('starts again with the match when it starts before the tournament key is taken', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    let matchId = '';
    const { service, taken } = gatedService(`tournament:${created.id}`, async () => {
      matchId = await started(created.id, 'g-1');
    });

    const view = await service.withdraw(created.id, { playerId: anna });
    expect(taken).toEqual([`tournament:${created.id}`, matchId, `tournament:${created.id}`]);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'walkover', matchId });
    expect((await logEntries(t.db, matchId)).map((entry) => [entry.type, entry.player_id])).toEqual([['match_abandoned', anna]]);
  });
});

describe('live updates', () => {
  async function listen<T>(url: string, parse: (message: unknown) => T) {
    const messages: unknown[] = [];
    const socket: TestSocket = await t.app.injectWS(
      url,
      {},
      {
        onInit(ws: TestSocket) {
          ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
        },
      },
    );
    sockets.push(socket);
    return async (count: number): Promise<T[]> => {
      await vi.waitFor(() => expect(messages.length).toBeGreaterThanOrEqual(count));
      return messages.map(parse);
    };
  }

  it('sends the tournament after a withdrawal and a correction and the abandoned match state', async () => {
    const { anna, bartek, celina, darek } = await fourPlayers();
    const created = await league([anna, bartek, celina, darek]);
    await playFixture(t.app, created.id, 'g-2');
    const matchId = await started(created.id, 'g-1');
    const tournament = await listen(`/tournaments/${created.id}/live`, (message) => TournamentLiveMessage.parse(message));
    const match = await listen(`/matches/${matchId}/live`, (message) => LiveMessage.parse(message));
    const [first] = await tournament(1);
    await match(1);
    const seq = first?.eventSeq ?? 0;

    expect((await withdraw(t.app, created.id, { playerId: anna })).statusCode).toBe(201);
    const [, withdrawn] = await tournament(2);
    expect(withdrawn).toMatchObject({ type: 'tournament_updated', tournamentId: created.id, eventSeq: seq + 1 });
    expect(fixtureOf(withdrawn?.tournament ?? created, 'g-1').status).toBe('walkover');
    const [, abandoned] = await match(2);
    expect(abandoned).toMatchObject({ type: 'state_updated', matchId, state: { abandonment: { playerId: anna } } });

    expect((await correctResult(t.app, created.id, 'g-2', { legs: [0, 1] })).statusCode).toBe(200);
    const [, , corrected] = await tournament(3);
    expect(corrected).toMatchObject({ type: 'tournament_updated', eventSeq: seq + 2 });
    expect(fixtureOf(corrected?.tournament ?? created, 'g-2').result).toMatchObject({ winnerId: darek, corrected: true });
  });
});
