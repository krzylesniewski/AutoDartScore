import { ApiError, TournamentListItem, TournamentStaleStateError, TournamentView } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  countRows,
  createPlayer,
  createPlayers,
  createTournament,
  getTournament,
  patchPlayer,
  playFixture,
  postTournament,
  setup,
  startFixture,
  type TestApp,
} from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

function command(tournamentId: string, name: 'draw' | 'archive', payload?: object) {
  return t.app.inject({ method: 'POST', url: `/tournaments/${tournamentId}/${name}`, ...(payload && { payload }) });
}

function league(playerIds: readonly string[]) {
  return createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds });
}

function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, error: string): void {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(error);
}

describe('POST /tournaments', () => {
  it('rejects a second tournament while one is in progress and accepts one after it finishes', async () => {
    const players = await createPlayers(t.app, 3);
    const cup = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
    expectError(await postTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players }), 409, 'tournament_active');

    await playFixture(t.app, cup.id, 'p-sf-2');
    await playFixture(t.app, cup.id, 'p-f');
    const response = await postTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });
    expect(response.statusCode).toBe(201);
  });

  it('creates one of two parallel tournaments', async () => {
    const players = await createPlayers(t.app, 3);
    const payload = { name: 'Liga testowa', format: 'league', playerIds: players };
    const responses = await Promise.all([postTournament(t.app, payload), postTournament(t.app, payload)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
    expect(responses.find((response) => response.statusCode === 409)?.json()).toMatchObject({ error: 'tournament_active' });
    expect(await countRows(t.db, 'tournaments')).toBe(1);
  });

  it('rejects unknown and archived players, accepts a guest and rejects an invalid body', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    const archived = await createPlayer(t.app, 'Celina');
    expect((await patchPlayer(t.app, archived.id, { archived: true })).statusCode).toBe(200);

    const unknown = await postTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: [anna, bartek, 'nope'] });
    expectError(unknown, 400, 'unknown_player');
    expect(unknown.json()).toMatchObject({ message: 'Unknown player: nope' });
    expectError(
      await postTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: [anna, bartek, archived.id] }),
      400,
      'archived_player',
    );
    expectError(await postTournament(t.app, {}), 400, 'invalid_request');
    expectError(await postTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: [anna, bartek] }), 400, 'invalid_request');
    expect(await countRows(t.db, 'tournaments')).toBe(0);

    const created = await league([anna as string, bartek as string, guest.id]);
    expect(created.players.map((player) => [player.id, player.guest])).toEqual([
      [anna, false],
      [bartek, false],
      [guest.id, true],
    ]);
  });

  it('stores the config with its defaults', async () => {
    const players = await createPlayers(t.app, 4);
    const response = await postTournament(t.app, {
      name: '  Grupa testowa  ',
      format: 'group_playoff',
      playerIds: players,
      advance: 2,
      sharing: false,
    });
    expect(response.statusCode).toBe(201);
    const view = TournamentView.parse(response.json());
    expect(view.config).toEqual({
      name: 'Grupa testowa',
      format: 'group_playoff',
      playerIds: players,
      startingScore: 501,
      advance: 2,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
      sharing: false,
    });
    expect(view).toMatchObject({ name: 'Grupa testowa', sharing: false, archivedAt: null, finishedAt: null, eventSeq: 1 });
    expect(await getTournament(t.app, view.id)).toEqual(view);
  });
});

describe('POST /tournaments/:id/fixtures/:fixtureId/start', () => {
  it('returns the same match for a repeated start and creates one match for two parallel starts', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await league(players);
    const [first, second] = await Promise.all([startFixture(t.app, created.id, 'g-1'), startFixture(t.app, created.id, 'g-1')]);
    expect([first.statusCode, second.statusCode]).toEqual([201, 200]);
    const matchId = first.json<{ matchId: string }>().matchId;
    expect(second.json()).toMatchObject({ matchId, tournament: { eventSeq: 2 } });
    expect(await countRows(t.db, 'matches')).toBe(1);

    const repeated = await startFixture(t.app, created.id, 'g-1', { expectedSeq: 0 });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toMatchObject({ matchId });
    expect(await countRows(t.db, 'matches')).toBe(1);
    expect(await countRows(t.db, 'tournament_events')).toBe(2);
  });

  it('rejects a waiting fixture, an unknown fixture and a stale expectedSeq', async () => {
    const players = await createPlayers(t.app, 3);
    const cup = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
    expectError(await startFixture(t.app, cup.id, 'p-f'), 409, 'fixture_not_ready');
    expectError(await startFixture(t.app, cup.id, 'g-1'), 404, 'not_found');
    const stale = await startFixture(t.app, cup.id, 'p-sf-2', { expectedSeq: 3 });
    expect(stale.statusCode).toBe(409);
    expect(TournamentStaleStateError.parse(stale.json()).tournament.eventSeq).toBe(1);
    expect((await startFixture(t.app, cup.id, 'p-sf-2', { expectedSeq: 1 })).statusCode).toBe(201);
    expect(await countRows(t.db, 'matches')).toBe(1);
  });
});

describe('POST /tournaments/:id/draw', () => {
  it('redraws before the first start and rejects a redraw after it', async () => {
    const players = await createPlayers(t.app, 4);
    const created = await league(players);
    const redraw = await command(created.id, 'draw');
    expect(redraw.statusCode).toBe(200);
    const view = TournamentView.parse(redraw.json());
    expect(view).toMatchObject({ eventSeq: 2, canRedraw: true, status: 'in_progress' });
    expect(view.players).toEqual(created.players);
    expect(await countRows(t.db, 'tournament_events')).toBe(2);

    expect((await command(created.id, 'draw', { expectedSeq: 2 })).statusCode).toBe(200);
    expect((await startFixture(t.app, created.id, 'g-1')).statusCode).toBe(201);
    expectError(await command(created.id, 'draw'), 409, 'tournament_started');
    expect(await countRows(t.db, 'tournament_events')).toBe(4);
  });

  it('rejects a stale expectedSeq with the current view and an invalid body', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await league(players);
    const stale = await command(created.id, 'draw', { expectedSeq: 5 });
    expect(stale.statusCode).toBe(409);
    const body = TournamentStaleStateError.parse(stale.json());
    expect(ApiError.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ error: 'stale_state', tournament: { id: created.id, eventSeq: 1 } });
    expect(body.tournament).toEqual(await getTournament(t.app, created.id));

    expectError(await command(created.id, 'draw', { expectedSeq: -1 }), 400, 'invalid_request');
    expect(await countRows(t.db, 'tournament_events')).toBe(1);
  });
});

describe('POST /tournaments/:id/archive', () => {
  it('archives only a finished tournament, hides it from the list and rejects a second archive', async () => {
    const players = await createPlayers(t.app, 3);
    const cup = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
    expectError(await command(cup.id, 'archive'), 409, 'tournament_not_finished');

    await playFixture(t.app, cup.id, 'p-sf-2');
    await playFixture(t.app, cup.id, 'p-f');

    const archived = await command(cup.id, 'archive');
    expect(archived.statusCode).toBe(200);
    const view = TournamentView.parse(archived.json());
    expect(view.archivedAt).not.toBeNull();
    expect(view).toMatchObject({ status: 'finished', eventSeq: 4 });
    expect(await getTournament(t.app, cup.id)).toEqual(view);

    const list = await t.app.inject({ method: 'GET', url: '/tournaments' });
    expect(list.json()).toEqual([]);
    const all = await t.app.inject({ method: 'GET', url: '/tournaments?archived=include' });
    expect(all.json<TournamentListItem[]>().map((item) => [item.id, item.archivedAt])).toEqual([[cup.id, view.archivedAt]]);

    expectError(await command(cup.id, 'archive'), 409, 'tournament_archived');
    expectError(await command(cup.id, 'draw'), 409, 'tournament_archived');
  });
});

describe('unknown tournament', () => {
  it('gives 404 on GET and on each command', async () => {
    expectError(await t.app.inject({ method: 'GET', url: '/tournaments/t_nope' }), 404, 'not_found');
    expectError(await command('t_nope', 'draw'), 404, 'not_found');
    expectError(await command('t_nope', 'archive'), 404, 'not_found');
    expectError(await startFixture(t.app, 't_nope', 'g-1'), 404, 'not_found');
  });
});
