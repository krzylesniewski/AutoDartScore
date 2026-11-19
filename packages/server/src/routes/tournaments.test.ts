import { TournamentListItem, type MatchListItem, type TournamentView } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEG_301,
  S,
  abandon,
  createGame,
  createPlayers,
  createTournament,
  fixtureOf,
  getMatch,
  getTournament,
  listMatches,
  playFixture,
  resume,
  slotPlayers,
  startFixture,
  throwDarts,
  setup,
  type TestApp,
} from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

interface Tally {
  played: number;
  won: number;
  lost: number;
  legsFor: number;
  legsAgainst: number;
}

function emptyTally(): Tally {
  return { played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0 };
}

// Mecz do 1 lega: zwycięzca ma 1:0 w legach.
function record(tally: Tally | undefined, won: boolean): void {
  expect(tally).toBeDefined();
  const row = tally as Tally;
  row.played++;
  row.won += won ? 1 : 0;
  row.lost += won ? 0 : 1;
  row.legsFor += won ? 1 : 0;
  row.legsAgainst += won ? 0 : 1;
}

function expectStandings(view: TournamentView, tallies: ReadonlyMap<string, Tally>): void {
  expect(view.standings).toHaveLength(tallies.size);
  for (const [playerId, tally] of tallies) {
    expect(view.standings.find((row) => row.playerId === playerId)).toMatchObject({ ...tally, points: tally.won * 2 });
  }
}

describe('league', () => {
  it('plays a league of 4 through the API and updates the standings after every match', async () => {
    const players = await createPlayers(t.app, 4);
    const created = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });
    expect(created).toMatchObject({ name: 'Liga testowa', format: 'league', status: 'in_progress', eventSeq: 1, canRedraw: true });
    expect(created.id).toMatch(/^t_[A-Za-z0-9_-]{22}$/);
    expect(created.players.map((player) => player.id)).toEqual(players);
    expect(created.fixtures).toHaveLength(6);
    expect(created.fixtures.every((fixture) => fixture.status === 'ready')).toBe(true);

    const tallies = new Map(players.map((id) => [id, emptyTally()]));
    let view = created;
    let played = 0;
    while (view.nextFixtureId !== null) {
      const fixtureId = view.nextFixtureId;
      const [first, second] = slotPlayers(fixtureOf(view, fixtureId));
      const { matchId, winnerId, tournament } = await playFixture(t.app, view.id, fixtureId);
      played++;
      expect(winnerId).toBe(first);
      expect(fixtureOf(tournament, fixtureId)).toMatchObject({
        status: 'finished',
        matchId,
        result: { legs: [1, 0], winnerId: first, corrected: false },
      });
      record(tallies.get(first), true);
      record(tallies.get(second), false);
      expectStandings(tournament, tallies);
      expect(tournament.canRedraw).toBe(false);
      expect(tournament.eventSeq).toBe(1 + played);
      view = tournament;
    }

    expect(played).toBe(6);
    expect(view.status).toBe('finished');
    expect(view.finishedAt).not.toBeNull();
    expect(view.liveFixtureId).toBeNull();
    expect(view.placements.map((placement) => placement.playerId).sort()).toEqual([...players].sort());
    expect(view).toEqual(await getTournament(t.app, view.id));
  });

  it('shows the started fixture as in progress and live', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });
    const fixtureId = created.nextFixtureId as string;
    const response = await startFixture(t.app, created.id, fixtureId);
    expect(response.statusCode).toBe(201);
    const { matchId, tournament } = response.json<{ matchId: string; tournament: TournamentView }>();
    expect(tournament).toMatchObject({ liveFixtureId: fixtureId, eventSeq: 2 });
    expect(fixtureOf(tournament, fixtureId)).toMatchObject({ status: 'in_progress', matchId, result: null });

    const match = await getMatch(t.app, matchId);
    const fixture = fixtureOf(tournament, fixtureId);
    expect(match).toMatchObject({ type: 'match', startingScore: 301, legsToWin: fixture.legsToWin, countsToStats: true });
    expect(match.players.map((player) => player.id)).toEqual(slotPlayers(fixture));
  });
});

describe('cup', () => {
  it('plays a cup of 3 with a bye to the final', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
    expect(created.standings).toEqual([]);
    const bye = created.fixtures.find((fixture) => fixture.status === 'bye');
    expect(bye).toBeDefined();
    const byeStart = await startFixture(t.app, created.id, bye?.id as string);
    expect(byeStart.statusCode).toBe(409);
    expect(byeStart.json()).toMatchObject({ error: 'fixture_not_ready' });

    const final = fixtureOf(created, 'p-f');
    expect(final.status).toBe('waiting');
    const early = await startFixture(t.app, created.id, 'p-f');
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: 'fixture_not_ready' });

    const semi = created.nextFixtureId as string;
    expect(semi).not.toBe('p-f');
    const afterSemi = await playFixture(t.app, created.id, semi);
    expect(fixtureOf(afterSemi.tournament, 'p-f').status).toBe('ready');
    expect(slotPlayers(fixtureOf(afterSemi.tournament, 'p-f'))).toContain(afterSemi.winnerId);
    expect(afterSemi.tournament.status).toBe('in_progress');

    const { winnerId, tournament } = await playFixture(t.app, created.id, 'p-f');
    expect(tournament.status).toBe('finished');
    expect(tournament.finishedAt).not.toBeNull();
    expect(tournament.placements).toContainEqual({ playerId: winnerId, place: 1 });
  });
});

describe('group and play-off', () => {
  it('fills the final from the group standings and plays it', async () => {
    const players = await createPlayers(t.app, 4);
    let view = await createTournament(t.app, { name: 'Grupa testowa', format: 'group_playoff', playerIds: players, advance: 2 });
    expect(view.fixtures.map((fixture) => fixture.id)).toEqual(['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6', 'p-f']);

    while (view.nextFixtureId?.startsWith('g-')) {
      expect(fixtureOf(view, 'p-f')).toMatchObject({
        status: 'waiting',
        slots: [
          { kind: 'standing', place: 1 },
          { kind: 'standing', place: 2 },
        ],
      });
      view = (await playFixture(t.app, view.id, view.nextFixtureId)).tournament;
    }

    const final = fixtureOf(view, 'p-f');
    expect(final.status).toBe('ready');
    const [first, second] = view.standings;
    expect(slotPlayers(final)).toEqual([first?.playerId, second?.playerId]);
    expect(view.standings.filter((row) => row.advances).map((row) => row.place)).toEqual([1, 2]);

    const { winnerId, tournament } = await playFixture(t.app, view.id, 'p-f');
    expect(winnerId).toBe(first?.playerId);
    expect(tournament.status).toBe('finished');
    expect(tournament.placements).toContainEqual({ playerId: winnerId, place: 1 });
    expect(tournament.placements).toContainEqual({ playerId: second?.playerId, place: 2 });
  });
});

describe('fixture matches', () => {
  it('carry the tournament in GET /matches/:id and GET /matches, regular matches carry null', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });
    const response = await startFixture(t.app, created.id, 'g-1');
    const { matchId } = response.json<{ matchId: string }>();
    const regular = await createGame(t.app, { type: 'match', playerIds: players.slice(0, 2), startingScore: 301 });

    const link = { id: created.id, name: 'Liga testowa', fixtureId: 'g-1', label: 'Liga, mecz 1' };
    expect((await getMatch(t.app, matchId)).tournament).toEqual(link);
    expect((await getMatch(t.app, regular.id)).tournament).toBeNull();

    const list = (await listMatches(t.app)).json<MatchListItem[]>();
    expect(list.find((item) => item.id === matchId)?.tournament).toEqual(link);
    expect(list.find((item) => item.id === regular.id)?.tournament).toBeNull();
  });

  it('labels a play-off fixture match', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
    const semi = await playFixture(t.app, created.id, created.nextFixtureId as string);
    expect((await getMatch(t.app, semi.matchId)).tournament).toMatchObject({ fixtureId: 'p-sf-2', label: 'Półfinał 2' });
  });

  it('keeps an abandoned and resumed fixture match in progress with the same match', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });
    const { matchId } = (await startFixture(t.app, created.id, 'g-1')).json<{ matchId: string }>();
    await throwDarts(t.app, matchId, [S(20)]);
    const [first] = slotPlayers(fixtureOf(created, 'g-1'));

    expect((await abandon(t.app, matchId, { playerId: first })).statusCode).toBe(200);
    let view = await getTournament(t.app, created.id);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'in_progress', matchId });
    const repeated = await startFixture(t.app, created.id, 'g-1');
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json()).toMatchObject({ matchId });

    expect((await resume(t.app, matchId)).statusCode).toBe(200);
    view = await getTournament(t.app, created.id);
    expect(fixtureOf(view, 'g-1')).toMatchObject({ status: 'in_progress', matchId });
    expect(view.liveFixtureId).toBe('g-1');
    expect((await getMatch(t.app, matchId)).status).toBe('in_progress');
  });
});

describe('corrupt tournament', () => {
  it('fails the tournament read with 500 but keeps the throw response of a fixture match', async () => {
    const players = await createPlayers(t.app, 3);
    const created = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });
    const { matchId } = (await startFixture(t.app, created.id, 'g-1')).json<{ matchId: string }>();
    await t.db
      .insertInto('tournament_events')
      .values({ tournament_id: created.id, seq: 3, type: 'draw', draw_order: 'nie json', created_at: new Date().toISOString() })
      .execute();

    const results = await throwDarts(t.app, matchId, LEG_301);
    expect(results.at(-1)?.state).toMatchObject({ status: 'finished', tournament: { id: created.id, fixtureId: 'g-1' } });
    const read = await t.app.inject({ method: 'GET', url: `/tournaments/${created.id}` });
    expect(read.statusCode).toBe(500);
    expect(read.json()).toMatchObject({ error: 'internal_error' });
  });
});

describe('GET /tournaments', () => {
  it('lists the tournaments newest first with the list fields and filters by status', async () => {
    const players = await createPlayers(t.app, 3);
    const first = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds: players });
    await playFixture(t.app, first.id, 'p-sf-2');
    await playFixture(t.app, first.id, 'p-f');
    const second = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: players });

    const response = await t.app.inject({ method: 'GET', url: '/tournaments' });
    expect(response.statusCode).toBe(200);
    const items = response.json<TournamentListItem[]>().map((item) => TournamentListItem.parse(item));
    expect(items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(
      ['archivedAt', 'createdAt', 'finishedAt', 'format', 'id', 'name', 'placements', 'players', 'status'].sort(),
    );
    expect(items[1]).toMatchObject({ status: 'finished', archivedAt: null });

    const finished = await t.app.inject({ method: 'GET', url: '/tournaments?status=finished' });
    expect(finished.json<TournamentListItem[]>().map((item) => item.id)).toEqual([first.id]);
    const running = await t.app.inject({ method: 'GET', url: '/tournaments?status=in_progress' });
    expect(running.json<TournamentListItem[]>().map((item) => item.id)).toEqual([second.id]);
    const invalid = await t.app.inject({ method: 'GET', url: '/tournaments?status=archived' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: 'invalid_request' });
  });
});
