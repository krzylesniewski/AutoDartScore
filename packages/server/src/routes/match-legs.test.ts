import { ApiError, MatchLegs, MatchSummary, StartFixtureResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  D,
  LEG_301,
  MISS,
  S,
  T,
  abandon,
  createGame,
  createPlayers,
  createTournament,
  setup,
  startFixture,
  throwDarts,
  type TestApp,
} from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

async function legsOf(matchId: string): Promise<MatchLegs> {
  const response = await t.app.inject({ method: 'GET', url: `/matches/${matchId}/legs` });
  expect(response.statusCode).toBe(200);
  return MatchLegs.parse(response.json());
}

function expectError(response: { statusCode: number; json(): unknown }, statusCode: number, error: string): void {
  expect(response.statusCode).toBe(statusCode);
  expect(ApiError.parse(response.json()).error).toBe(error);
}

async function match(legsToWin: number) {
  const playerIds = await createPlayers(t.app, 2);
  const game = await createGame(t.app, { type: 'match', playerIds, startingScore: 301, legsToWin });
  return { id: game.id, playerIds: playerIds as [string, string] };
}

describe('GET /matches/:id/legs', () => {
  it('gives the turns, winner and leg averages of a finished one-leg match', async () => {
    const { id, playerIds } = await match(1);
    await throwDarts(t.app, id, LEG_301);
    const result = await legsOf(id);
    expect(result).toMatchObject({ matchId: id, finished: true, startingScore: 301, legsToWin: 1, players: playerIds });
    expect(result.eventSeq).toBeGreaterThan(0);
    expect(result.legs).toHaveLength(1);
    const [leg] = result.legs;
    expect(leg).toMatchObject({ legIndex: 0, starterId: playerIds[0], winnerId: playerIds[0], checkout: 121, dartsThrown: 6 });
    expect(leg?.turns.map((turn) => [turn.turnIndex, turn.points, turn.remainingAfter])).toEqual([
      [0, 180, 121],
      [1, 0, 301],
      [2, 121, 0],
    ]);
    expect(leg?.players).toEqual([
      { playerId: playerIds[0], darts: 6, average: 150.5 },
      { playerId: playerIds[1], darts: 3, average: 0 },
    ]);
  });

  it('alternates the starter and shows the next leg without a winner while the match runs', async () => {
    const { id, playerIds } = await match(2);
    await throwDarts(t.app, id, LEG_301);
    const result = await legsOf(id);
    expect(result.finished).toBe(false);
    expect(result.legs).toHaveLength(2);
    expect(result.legs[1]).toMatchObject({
      legIndex: 1,
      starterId: playerIds[1],
      winnerId: null,
      checkout: null,
      dartsThrown: null,
      turns: [],
    });

    await throwDarts(t.app, id, [MISS, MISS, MISS, S(20)]);
    const running = await legsOf(id);
    expect(running.legs[1]?.winnerId).toBeNull();
    expect(running.legs[1]?.turns.map((turn) => [turn.playerId, turn.turnIndex, turn.points, turn.remainingAfter])).toEqual([
      [playerIds[1], 0, 0, 301],
    ]);
  });

  it('matches the leg averages of the summary for every won leg', async () => {
    const { id } = await match(2);
    const second = [MISS, MISS, MISS, T(20), T(20), T(20), MISS, MISS, S(1), T(20), T(17), D(5)];
    await throwDarts(t.app, id, [...LEG_301, ...second]);
    const result = await legsOf(id);
    const summaryResponse = await t.app.inject({ method: 'GET', url: `/matches/${id}/summary` });
    const summary = MatchSummary.parse(summaryResponse.json());
    expect(result.finished).toBe(true);
    expect(summary.legs).toHaveLength(2);
    expect(result.legs.map((leg) => leg.starterId)).toEqual([result.players[0], result.players[1]]);
    for (const leg of summary.legs) {
      const own = result.legs[leg.legIndex];
      expect(own?.players.map(({ playerId, average }) => ({ playerId, average }))).toEqual(leg.averages);
      expect(own).toMatchObject({ winnerId: leg.winnerId, checkout: leg.checkout, dartsThrown: leg.dartsThrown });
    }
  });

  it('gives a bust turn 0 points and the score before the turn', async () => {
    const { id, playerIds } = await match(1);
    await throwDarts(t.app, id, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20)]);
    const [leg] = (await legsOf(id)).legs;
    expect(leg?.turns.at(-1)).toEqual({
      playerId: playerIds[0],
      turnIndex: 2,
      darts: [
        { segment: 20, multiplier: 3 },
        { segment: 20, multiplier: 3 },
      ],
      points: 0,
      remainingAfter: 121,
      bust: true,
    });
    expect(leg?.players[0]).toEqual({ playerId: playerIds[0], darts: 5, average: 108 });
  });

  it('gives one empty leg before the first dart and what an abandoned match has', async () => {
    const { id, playerIds } = await match(1);
    expect((await legsOf(id)).legs).toEqual([
      {
        legIndex: 0,
        starterId: playerIds[0],
        winnerId: null,
        checkout: null,
        dartsThrown: null,
        players: playerIds.map((playerId) => ({ playerId, darts: 0, average: null })),
        turns: [],
      },
    ]);
    await throwDarts(t.app, id, [T(20), T(20), T(20)]);
    expect((await abandon(t.app, id, { playerId: playerIds[1] })).statusCode).toBe(200);
    const abandoned = await legsOf(id);
    expect(abandoned.finished).toBe(false);
    expect(abandoned.legs[0]?.turns).toHaveLength(1);
  });

  it('serves a tournament match like a plain 1v1 match', async () => {
    const playerIds = await createPlayers(t.app, 3);
    const view = await createTournament(t.app, { name: 'Liga testowa', format: 'league', playerIds });
    const response = await startFixture(t.app, view.id, 'g-1');
    const { matchId } = StartFixtureResult.parse(response.json());
    await throwDarts(t.app, matchId, LEG_301);
    const result = await legsOf(matchId);
    expect(result).toMatchObject({ finished: true, legsToWin: 1 });
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0]).toMatchObject({ starterId: result.players[0], winnerId: result.players[0], checkout: 121, dartsThrown: 6 });
  });

  it('answers 409 not_a_match for casual and practice games and 404 for an unknown match', async () => {
    const playerIds = await createPlayers(t.app, 3);
    const casual = await createGame(t.app, { type: 'casual', playerIds, startingScore: 301 });
    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [playerIds[0]] });
    for (const id of [casual.id, solo.id]) {
      expectError(await t.app.inject({ method: 'GET', url: `/matches/${id}/legs` }), 409, 'not_a_match');
    }
    expectError(await t.app.inject({ method: 'GET', url: '/matches/m_missing/legs' }), 404, 'not_found');
  });
});
