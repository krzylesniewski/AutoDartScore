import { randomUUID } from 'node:crypto';
import { ApiError, MatchSnapshot, ThrowResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  D,
  LEG_301,
  MISS,
  S,
  T,
  countRows,
  createGame,
  createPlayer,
  createPlayers,
  getMatch,
  hitEvent,
  logEntries,
  postThrow,
  remaining,
  setup,
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

describe('POST /matches', () => {
  it('creates a 1v1 match with the defaults', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const state = MatchSnapshot.parse(await createGame(t.app, { type: 'match', playerIds: [anna, bartek] }));
    expect(state).toMatchObject({
      type: 'match',
      practiceMode: null,
      startingScore: 301,
      legsToWin: 1,
      countsToStats: true,
      finished: false,
      eventSeq: 0,
      currentPlayerId: anna,
      legIndex: 0,
      turnIndex: 0,
      currentDarts: [],
      winnerId: null,
      placements: [],
      freeRun: null,
      checkouts: null,
    });
    expect(state.players.map((player) => [player.id, player.remaining, player.legsWon, player.place])).toEqual([
      [anna, 301, 0, null],
      [bartek, 301, 0, null],
    ]);
  });

  it('creates a casual game, a solo 501 and a free run', async () => {
    const [anna, bartek, celina] = await createPlayers(t.app, 3);
    const casual = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    expect(casual).toMatchObject({ type: 'casual', startingScore: 301, legsToWin: null, countsToStats: true });
    expect(casual.players.map((player) => player.legsWon)).toEqual([null, null, null]);

    const solo = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    expect(solo).toMatchObject({ practiceMode: 'solo_501', startingScore: 501, countsToStats: true, currentPlayerId: anna });
    expect(remaining(solo)).toEqual([501]);

    const freeRun = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    expect(freeRun).toMatchObject({
      practiceMode: 'free_run',
      startingScore: null,
      countsToStats: false,
      freeRun: { dartsThrown: 0, totalPoints: 0, average: 0 },
      checkouts: null,
    });
    expect(remaining(freeRun)).toEqual([null]);
  });

  it('draws the starting player with random()', async () => {
    await t.close();
    t = await setup({ random: () => 0.99 });
    const [anna, bartek] = await createPlayers(t.app, 2);
    const state = await createGame(t.app, { type: 'match', playerIds: [anna, bartek] });
    expect(state.currentPlayerId).toBe(bartek);
  });

  it.each([
    ['a bad player count', (ids: string[]) => ({ type: 'match', playerIds: ids.slice(0, 3) }), 'invalid_request'],
    ['startingScore 401', (ids: string[]) => ({ type: 'match', playerIds: ids.slice(0, 2), startingScore: 401 }), 'invalid_request'],
    ['an unknown player', (ids: string[]) => ({ type: 'casual', playerIds: [ids[0], 'ghost'] }), 'unknown_player'],
  ])('rejects %s with 400', async (_name, body, error) => {
    const ids = await createPlayers(t.app, 3);
    const response = await t.app.inject({ method: 'POST', url: '/matches', payload: body(ids) });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe(error);
  });

  it("gives every player's color in GET /matches/:id", async () => {
    const anna = await createPlayer(t.app, 'Anna');
    const bartek = await createPlayer(t.app, 'Bartek', { color: 7 });
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna.id, bartek.id] });
    const state = await getMatch(t.app, id);
    expect(state.players.map((player) => [player.id, player.color])).toEqual([
      [anna.id, anna.color],
      [bartek.id, 7],
    ]);
  });

  it('answers GET of an unknown match with 404', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/matches/nope' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });
});

describe('POST /matches/:id/throws', () => {
  async function match301(bestOf = 3) {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const state = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf });
    return { id: state.id, anna: anna!, bartek: bartek! };
  }

  it('completes a turn after three darts and switches the player', async () => {
    const { id, anna, bartek } = await match301();
    const [first, , third] = await throwDarts(t.app, id, [T(20), S(5), S(1)]);
    expect(ThrowResult.parse(first).events).toEqual([]);
    expect(first.state).toMatchObject({ eventSeq: 1, currentDarts: [{ segment: 20, multiplier: 3 }], currentPlayerId: anna });
    expect(third.events).toEqual([
      {
        type: 'turn_completed',
        playerId: anna,
        legIndex: 0,
        turnIndex: 0,
        darts: [
          { segment: 20, multiplier: 3 },
          { segment: 5, multiplier: 1 },
          { segment: 1, multiplier: 1 },
        ],
        total: 66,
        remaining: 235,
      },
    ]);
    expect(third.state).toMatchObject({ eventSeq: 3, currentPlayerId: bartek, turnIndex: 1, currentDarts: [] });
    expect(remaining(third.state)).toEqual([235, 301]);
  });

  it('restores the score from the start of the turn on a bust', async () => {
    const { id, anna, bartek } = await match301();
    await throwDarts(t.app, id, [T(20), T(20), T(20), MISS, MISS, MISS]); // anna 121
    const results = await throwDarts(t.app, id, [T(20), T(20)]); // 121 - 60 - 60 = 1, bust
    const bust = results[1];
    expect(bust.events).toEqual([expect.objectContaining({ type: 'bust', playerId: anna, remaining: 121 })]);
    expect(bust.state.currentPlayerId).toBe(bartek);
    expect(remaining(bust.state)).toEqual([121, 301]);
  });

  it('finishes a best-of-1 match and rejects a further throw', async () => {
    const { id, anna } = await match301(1);
    const results = await throwDarts(t.app, id, LEG_301);
    const last = ThrowResult.parse(results.at(-1));
    expect(last.events.map((event) => event.type)).toEqual(['turn_completed', 'leg_won', 'match_won']);
    expect(last.state).toMatchObject({ finished: true, winnerId: anna, currentPlayerId: null, eventSeq: 9 });
    expect(last.state.players.map((player) => player.legsWon)).toEqual([1, 0]);

    const response = await postThrow(t.app, id, hitEvent(id, S(20)));
    expect(response.statusCode).toBe(409);
    expect(ApiError.parse(response.json()).error).toBe('match_finished');
    expect(await logEntries(t.db, id)).toHaveLength(9);
    expect(await countRows(t.db, 'throws')).toBe(9);
  });

  it('rejects a treble Bull and a foreign matchId with 400', async () => {
    const { id } = await match301();
    const bull = await postThrow(t.app, id, { ...hitEvent(id, S(20)), segment: 25, multiplier: 3 });
    expect(bull.statusCode).toBe(400);
    expect(ApiError.parse(bull.json()).error).toBe('invalid_request');

    const foreign = await postThrow(t.app, id, hitEvent('other-match', S(20)));
    expect(foreign.statusCode).toBe(400);
    expect(ApiError.parse(foreign.json()).error).toBe('match_mismatch');
    expect(await countRows(t.db, 'throws')).toBe(0);
  });

  it('answers a throw to an unknown match with 404', async () => {
    const response = await postThrow(t.app, 'nope', hitEvent('nope', S(20)));
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });

  it('stores the hit fields as received', async () => {
    const { id } = await match301();
    const hit = hitEvent(id, S(20), { source: 'camera-1', sequence: 42, confidence: 0.4, detectedAt: '2026-10-15T18:30:12.345Z' });
    const result = ThrowResult.parse((await postThrow(t.app, id, hit)).json());
    expect(result.throw).toEqual({ ...hit, id: expect.any(String), receivedAt: expect.any(String) });
  });
});

describe('idempotency', () => {
  it('returns the stored throw for a resent HitEvent and writes nothing', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const hit = hitEvent(id, T(20));
    const first = await postThrow(t.app, id, hit);
    expect(first.statusCode).toBe(201);

    const again = await postThrow(t.app, id, hit);
    expect(again.statusCode).toBe(200);
    const result = ThrowResult.parse(again.json());
    expect(result.throw).toEqual(first.json().throw);
    expect(result.events).toEqual([]);
    expect(result.state).toEqual(first.json().state);
    expect(await countRows(t.db, 'throws')).toBe(1);
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });

  it('returns 200 for the resent winning dart after match_won', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, id, LEG_301.slice(0, -1));
    const winning = hitEvent(id, D(5));
    expect((await postThrow(t.app, id, winning)).statusCode).toBe(201);

    const again = await postThrow(t.app, id, winning);
    expect(again.statusCode).toBe(200);
    expect(ThrowResult.parse(again.json()).state.finished).toBe(true);
    expect(await logEntries(t.db, id)).toHaveLength(9);
  });

  it('rejects the same eventId on another match with 409', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const first = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const second = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const eventId = randomUUID();
    expect((await postThrow(t.app, first.id, hitEvent(first.id, S(20), { eventId }))).statusCode).toBe(201);

    const response = await postThrow(t.app, second.id, hitEvent(second.id, S(20), { eventId }));
    expect(response.statusCode).toBe(409);
    expect(ApiError.parse(response.json()).error).toBe('event_id_conflict');
    expect(await logEntries(t.db, second.id)).toHaveLength(0);
  });
});

describe('casual game', () => {
  it('places two finishers and gives the last place to the player who never checked out', async () => {
    const [anna, bartek, celina] = await createPlayers(t.app, 3);
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    const turn = (darts: ReturnType<typeof S>[]) => throwDarts(t.app, id, darts);

    await turn([T(20), T(20), T(20)]); // anna 121
    await turn([T(20), T(20), T(20)]); // bartek 121
    await turn([MISS, MISS, MISS]); // celina 301
    const annaOut = await turn([T(20), T(17), D(5)]);
    expect(annaOut.at(-1).events.map((event: { type: string }) => event.type)).toEqual(['turn_completed', 'player_finished']);
    expect(annaOut.at(-1).state.currentPlayerId).toBe(bartek);

    const bartekOut = await turn([T(20), T(17), D(5)]);
    const last = ThrowResult.parse(bartekOut.at(-1));
    expect(last.events.map((event) => event.type)).toEqual(['turn_completed', 'player_finished', 'casual_finished']);
    expect(last.events.filter((event) => event.type === 'player_finished').map((event) => event.playerId)).toEqual([bartek]);
    expect(last.state).toMatchObject({
      finished: true,
      currentPlayerId: null,
      winnerId: null,
      placements: [
        { playerId: anna, place: 1 },
        { playerId: bartek, place: 2 },
        { playerId: celina, place: 3 },
      ],
    });
    expect(last.state.players.map((player) => player.place)).toEqual([1, 2, 3]);
    expect(remaining(last.state)).toEqual([0, 0, 301]);
  });
});

describe('practice', () => {
  it('plays a solo 501 to the end', async () => {
    const [anna] = await createPlayers(t.app, 1);
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    const results = await throwDarts(t.app, id, [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)]);
    const last = ThrowResult.parse(results.at(-1));
    expect(last.events.map((event) => event.type)).toEqual(['turn_completed', 'leg_won']);
    expect(last.state).toMatchObject({ finished: true, winnerId: anna, currentPlayerId: null });
    expect(last.state.players[0]).toMatchObject({ remaining: 0, dartsThrownInLeg: 9 });
  });

  it('never finishes a free run and counts its darts', async () => {
    const [anna] = await createPlayers(t.app, 1);
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    const results = await throwDarts(t.app, id, Array.from({ length: 10 }, () => S(20)));
    expect(results.every((result) => result.events.length === 0)).toBe(true);
    const state = await getMatch(t.app, id);
    expect(state).toMatchObject({
      finished: false,
      currentPlayerId: anna,
      turnIndex: 3,
      currentDarts: [{ segment: 20, multiplier: 1 }],
      freeRun: { dartsThrown: 10, totalPoints: 200, average: 60 },
      checkouts: null,
    });
    expect(state.players[0]).toMatchObject({ remaining: null, dartsThrownInLeg: 10 });
  });
});
