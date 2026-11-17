import { ApiError, MatchSummary, StartFixtureResult, TournamentStats, TournamentView } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { threeDartAverage } from '../stats/tally.js';
import {
  D,
  MISS,
  T,
  correctResult,
  createPlayer,
  createPlayers,
  createTournament,
  fixtureOf,
  getTournament,
  playFixture,
  setup,
  slotPlayers,
  startFixture,
  throwDarts,
  undo,
  withdraw,
  type TestApp,
} from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

async function getOk(url: string): Promise<unknown> {
  const response = await t.app.inject({ method: 'GET', url });
  expect(response.statusCode).toBe(200);
  return response.json();
}

const summary = async (matchId: string) => MatchSummary.parse(await getOk(`/matches/${matchId}/summary`));
const tournamentStats = async (tournamentId: string) => TournamentStats.parse(await getOk(`/tournaments/${tournamentId}/stats`));

async function league(): Promise<TournamentView> {
  const playerIds = await createPlayers(t.app, 3);
  return createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds });
}

async function started(tournamentId: string, fixtureId: string): Promise<string> {
  const response = await startFixture(t.app, tournamentId, fixtureId);
  expect(response.statusCode).toBe(201);
  return StartFixtureResult.parse(response.json()).matchId;
}

describe('averages in the tournament view', () => {
  it('gives a played fixture the match averages of its summary', async () => {
    const view = await league();
    const { matchId, tournament } = await playFixture(t.app, view.id, 'g-1');
    const { players } = await summary(matchId);
    expect(fixtureOf(tournament, 'g-1').averages).toEqual([150.5, 0]);
    expect(fixtureOf(tournament, 'g-1').averages).toEqual(players.map((player) => player.average));
  });

  it('averages the summed points and darts of two group matches in the table', async () => {
    const view = await league();
    const first = await playFixture(t.app, view.id, 'g-1');
    const second = await playFixture(t.app, view.id, 'g-2');
    const [playerId] = slotPlayers(fixtureOf(view, 'g-1')).filter((id) => slotPlayers(fixtureOf(view, 'g-2')).includes(id));
    const lines = [...(await summary(first.matchId)).players, ...(await summary(second.matchId)).players].filter(
      (line) => line.playerId === playerId,
    );
    expect(lines).toHaveLength(2);
    const points = lines.reduce((sum, line) => sum + line.points, 0);
    const darts = lines.reduce((sum, line) => sum + line.dartsThrown, 0);
    const row = second.tournament.standings.find((candidate) => candidate.playerId === playerId);
    expect(row).toMatchObject({ played: 2 });
    expect(row?.average).toBe(threeDartAverage(points, darts));
  });

  it('keeps averages out of a walkover whose match was abandoned by the withdrawal', async () => {
    const view = await league();
    const matchId = await started(view.id, 'g-1');
    await throwDarts(t.app, matchId, [T(20), T(20), T(20), MISS, MISS, MISS]);
    const [, loser] = slotPlayers(fixtureOf(view, 'g-1'));
    const response = await withdraw(t.app, view.id, { playerId: loser });
    expect(response.statusCode).toBe(201);
    const after = TournamentView.parse(response.json());
    expect(fixtureOf(after, 'g-1')).toMatchObject({ status: 'walkover', matchId, averages: null });
  });

  it('drops the averages when the finishing dart is undone and leaves the play-off out of the table', async () => {
    const view = await league();
    const { matchId, tournament } = await playFixture(t.app, view.id, 'g-1');
    expect(fixtureOf(tournament, 'g-1').averages).toEqual([150.5, 0]);
    expect((await undo(t.app, matchId)).statusCode).toBe(200);
    const undone = await getTournament(t.app, view.id);
    expect(fixtureOf(undone, 'g-1')).toMatchObject({ status: 'in_progress', averages: null });
    expect(undone.standings.every((row) => row.average === null)).toBe(true);
  });

  it('keeps the table averages of the group when a play-off match is played', async () => {
    const playerIds = await createPlayers(t.app, 4);
    let view = await createTournament(t.app, { name: 'Grupa testowa', format: 'group_playoff', playerIds, advance: 2 });
    while (view.nextFixtureId?.startsWith('g-')) {
      view = (await playFixture(t.app, view.id, view.nextFixtureId)).tournament;
    }
    const averages = view.standings.map((row) => [row.playerId, row.average]);
    expect(averages.some(([, average]) => average !== null)).toBe(true);
    const { tournament } = await playFixture(t.app, view.id, 'p-f');
    expect(fixtureOf(tournament, 'p-f').averages).toEqual([150.5, 0]);
    expect(tournament.standings.map((row) => [row.playerId, row.average])).toEqual(averages);
  });
});

describe('GET /tournaments/:id/stats', () => {
  it('gives the rows and records of a league with two played matches', async () => {
    const view = await league();
    const g1 = await playFixture(t.app, view.id, 'g-1');
    const g2 = await playFixture(t.app, view.id, 'g-2');
    const stats = await tournamentStats(view.id);
    expect(stats.tournamentId).toBe(view.id);
    expect(stats.players.map((row) => row.playerId)).toEqual(view.players.map((player) => player.id));

    const record = { playerId: g1.winnerId, fixtureId: 'g-1', matchId: g1.matchId };
    expect(stats.records).toEqual({
      highestMatchAverage: { ...record, value: 150.5 },
      highestCheckout: { ...record, legIndex: 0, value: 121 },
      shortestLeg: { ...record, legIndex: 0, value: 6 },
      highestTurn: { ...record, legIndex: 0, value: 180 },
    });

    expect(g1.winnerId).not.toBe(g2.winnerId);
    for (const winnerId of [g1.winnerId, g2.winnerId]) {
      expect(stats.players.find((row) => row.playerId === winnerId)).toMatchObject({ won: 1, scores180: 1, bestLegDarts: 6 });
    }
    expect(stats.players.reduce((sum, row) => sum + row.played, 0)).toBe(4);
  });

  it('takes wins and legs from a correction and a walkover and throws only from finished matches', async () => {
    const view = await league();
    const g1 = await playFixture(t.app, view.id, 'g-1');
    const [winner, loser] = slotPlayers(fixtureOf(view, 'g-1'));
    expect((await correctResult(t.app, view.id, 'g-1', { legs: [0, 1] })).statusCode).toBe(200);
    const corrected = await getTournament(t.app, view.id);
    expect(fixtureOf(corrected, 'g-1')).toMatchObject({ result: { winnerId: loser, corrected: true }, averages: [150.5, 0] });

    // Trwający mecz g-2 nic nie wnosi, a wycofanie jego gracza robi z niego walkower.
    const g2 = await started(view.id, 'g-2');
    await throwDarts(t.app, g2, [T(20), T(20), T(20)]);
    const withdrawn = slotPlayers(fixtureOf(view, 'g-2')).find((id) => id !== winner && id !== loser) ?? '';
    const darts = (stats: TournamentStats) =>
      [winner, loser, withdrawn].map((id) => stats.players.find((row) => row.playerId === id)?.dartsThrown);
    let stats = await tournamentStats(view.id);
    expect(darts(stats)).toEqual([6, 3, 0]);

    expect((await withdraw(t.app, view.id, { playerId: withdrawn })).statusCode).toBe(201);
    stats = await tournamentStats(view.id);
    expect(stats.players.find((row) => row.playerId === winner)).toMatchObject({
      played: 2,
      won: 1,
      lost: 1,
      legsFor: 1,
      legsAgainst: 1,
      legDifference: 0,
      dartsThrown: 6,
      average: 150.5,
      scores180: 1,
      highestCheckout: 121,
    });
    expect(stats.players.find((row) => row.playerId === loser)).toMatchObject({
      played: 2,
      won: 2,
      legsFor: 2,
      legsAgainst: 0,
      dartsThrown: 3,
      average: 0,
    });
    expect(stats.players.find((row) => row.playerId === withdrawn)).toMatchObject({ played: 2, lost: 2, legsAgainst: 2, dartsThrown: 0 });
    expect(stats.records.highestTurn).toMatchObject({ playerId: winner, matchId: g1.matchId, value: 180 });
  });

  it('includes guests and gives no records before any finished match', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    const view = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds: [anna, bartek, guest.id] });
    const matchId = await started(view.id, 'g-1');
    await throwDarts(t.app, matchId, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17)]);
    const stats = await tournamentStats(view.id);
    expect(stats.players.map((row) => row.playerId)).toEqual([anna, bartek, guest.id]);
    expect(stats.players.every((row) => row.played === 0 && row.dartsThrown === 0 && row.average === null)).toBe(true);
    expect(stats.records).toEqual({ highestMatchAverage: null, highestCheckout: null, shortestLeg: null, highestTurn: null });
    await throwDarts(t.app, matchId, [D(5)]);
    expect((await tournamentStats(view.id)).records.highestCheckout).toMatchObject({ matchId, value: 121 });
  });

  it('serves an archived cup and does not count a bye as a match', async () => {
    const playerIds = await createPlayers(t.app, 3);
    const cup = await createTournament(t.app, { name: 'Puchar testowy', format: 'cup', playerIds });
    expect(fixtureOf(cup, 'p-sf-1').status).toBe('bye');
    await playFixture(t.app, cup.id, 'p-sf-2');
    const { tournament } = await playFixture(t.app, cup.id, 'p-f');
    expect(tournament.status).toBe('finished');
    expect((await t.app.inject({ method: 'POST', url: `/tournaments/${cup.id}/archive` })).statusCode).toBe(200);
    const stats = await tournamentStats(cup.id);
    expect(stats.players.map((row) => row.played).sort()).toEqual([1, 1, 2]);
    expect(stats.players.reduce((sum, row) => sum + row.won, 0)).toBe(2);
  });

  it('answers 404 for an unknown tournament', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/tournaments/t_missing/stats' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });
});
