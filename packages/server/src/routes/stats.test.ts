import { ApiError, MatchSummary, PlayerStats } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, LEG_301, MISS, S, T, abandon, createGame, createPlayer, createPlayers, endPractice, setup, throwDarts, undo, type TestApp } from '../test-helpers.js';

let t: TestApp;
let anna: string;
let bartek: string;
beforeEach(async () => {
  t = await setup();
  [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
});
afterEach(async () => {
  await t.close();
});

// Solo 501: 180, 180, potem 141 (T20 T19 D12).
const SOLO_501 = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

async function stats(playerId: string, type?: string): Promise<PlayerStats> {
  const response = await t.app.inject({ method: 'GET', url: `/players/${playerId}/stats${type ? `?type=${type}` : ''}` });
  expect(response.statusCode).toBe(200);
  return PlayerStats.parse(response.json());
}

async function summary(matchId: string): Promise<MatchSummary> {
  const response = await t.app.inject({ method: 'GET', url: `/matches/${matchId}/summary` });
  expect(response.statusCode).toBe(200);
  return MatchSummary.parse(response.json());
}

async function playLeg301(): Promise<string> {
  const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
  await throwDarts(t.app, id, LEG_301);
  return id;
}

async function playSolo501(): Promise<string> {
  const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
  await throwDarts(t.app, id, SOLO_501);
  return id;
}

const annaLeg301 = {
  dartsThrown: 6,
  points: 301,
  average: 150.5,
  first9Average: 150.5,
  scores180: 1,
  scores140: 0,
  scores100: 1,
  scores60: 0,
  highestCheckout: 121,
  doubleAttempts: 1,
  doublesHit: 1,
  doublesPercent: 100,
  bestLegDarts: 6,
  legsWon: 1,
};

const bartekLeg301 = {
  dartsThrown: 3,
  points: 0,
  average: 0,
  first9Average: 0,
  scores180: 0,
  scores140: 0,
  scores100: 0,
  scores60: 0,
  highestCheckout: null,
  doubleAttempts: 0,
  doublesHit: 0,
  doublesPercent: null,
  bestLegDarts: null,
  legsWon: 0,
};

const point = (dart: number, remaining: number, bust = false) => ({ dart, remaining, bust });

// LEG_301: Anna 180, Bartek trzy pudła, Anna 121 (T20 T17 D5).
const annaLeg301Points = [point(1, 241), point(2, 181), point(3, 121), point(4, 61), point(5, 10), point(6, 0)];
const bartekLeg301Points = [point(1, 301), point(2, 301), point(3, 301)];

const noThrows = {
  ...bartekLeg301,
  dartsThrown: 0,
  average: null,
  first9Average: null,
};

describe('GET /players/:id/stats', () => {
  it('counts the LEG_301 match for both players', async () => {
    await playLeg301();
    expect(await stats(anna)).toEqual({ ...annaLeg301, playerId: anna, filter: 'all', matchesPlayed: 1, matchesWon: 1 });
    expect(await stats(bartek)).toEqual({ ...bartekLeg301, playerId: bartek, filter: 'all', matchesPlayed: 1, matchesWon: 0 });
  });

  it('gives zeros and nulls to a player without throws', async () => {
    expect(await stats(anna)).toEqual({ ...noThrows, playerId: anna, filter: 'all', matchesPlayed: 0, matchesWon: 0 });
  });

  it('counts a Solo 501 under practice, but not under match', async () => {
    await playSolo501();
    expect(await stats(anna, 'practice')).toMatchObject({
      filter: 'practice',
      dartsThrown: 9,
      average: 167,
      first9Average: 167,
      scores180: 2,
      scores140: 1,
      highestCheckout: 141,
      doubleAttempts: 1,
      doublesHit: 1,
      bestLegDarts: 9,
      legsWon: 0,
      matchesPlayed: 0,
      matchesWon: 0,
    });
    expect(await stats(anna, 'match')).toEqual({ ...noThrows, playerId: anna, filter: 'match', matchesPlayed: 0, matchesWon: 0 });
  });

  it('adds Solo 501 to checkouts and best leg, but not to legs or matches won', async () => {
    await playLeg301();
    await playSolo501();
    expect(await stats(anna)).toMatchObject({ dartsThrown: 15, highestCheckout: 141, bestLegDarts: 6, legsWon: 1, matchesPlayed: 1, matchesWon: 1 });
  });

  it('never counts Free run throws', async () => {
    await playLeg301();
    const before = await stats(anna);
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), T(20), T(20), T(20), T(20), T(20)]);
    expect(await stats(anna)).toEqual(before);
    expect(await stats(anna, 'practice')).toEqual({ ...noThrows, playerId: anna, filter: 'practice', matchesPlayed: 0, matchesWon: 0 });
  });

  it('does not count an undone throw', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, id, [T(20), T(20), S(1)]);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    await throwDarts(t.app, id, [T(20)]);
    expect(await stats(anna)).toMatchObject({ dartsThrown: 3, points: 180, scores180: 1, scores100: 0, matchesPlayed: 0 });
  });

  it('separates casual games and counts 1st place as a won leg and match', async () => {
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek], startingScore: 301 });
    await throwDarts(t.app, id, LEG_301);
    expect(await stats(anna, 'casual')).toMatchObject({ dartsThrown: 6, highestCheckout: 121, legsWon: 1, matchesPlayed: 1, matchesWon: 1 });
    expect(await stats(bartek, 'casual')).toMatchObject({ dartsThrown: 3, legsWon: 0, matchesPlayed: 1, matchesWon: 0 });
    expect(await stats(anna, 'match')).toMatchObject({ dartsThrown: 0, matchesPlayed: 0 });
  });

  it('leaves the interrupted leg of an abandoned game out of the average, but not out of the darts', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 });
    // Bartek zaczyna drugi leg. Anna rzuca w nim S1 S1 S1, zanim gra zostaje porzucona.
    await throwDarts(t.app, id, [...LEG_301, MISS, MISS, MISS, S(1), S(1), S(1)]);
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);

    expect(await stats(anna)).toMatchObject({ dartsThrown: 9, points: 304, average: 150.5, legsWon: 1, matchesPlayed: 0 });
    expect(await stats(bartek)).toMatchObject({ dartsThrown: 6, points: 0, average: 0 });
  });

  it('counts no average, leg or match for a game abandoned before its first leg ended', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, id, [T(20), T(20), T(20)]);
    expect((await abandon(t.app, id, { playerId: anna })).statusCode).toBe(200);

    expect(await stats(anna)).toMatchObject({ dartsThrown: 3, points: 180, average: null, legsWon: 0, matchesPlayed: 0, matchesWon: 0 });
  });

  it('gives a null average to a Solo 501 ended before zero', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'solo_501', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), T(20), T(20)]);
    expect((await endPractice(t.app, id)).statusCode).toBe(200);
    expect(await stats(anna, 'practice')).toMatchObject({ dartsThrown: 3, points: 180, average: null, first9Average: 180 });
  });

  it('answers 404 for an unknown player', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/players/nobody/stats' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });

  it('answers 400 for an unknown filter', async () => {
    const response = await t.app.inject({ method: 'GET', url: `/players/${anna}/stats?type=bogus` });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });
});

describe('GET /matches/:id/summary', () => {
  it('summarises the LEG_301 match', async () => {
    const id = await playLeg301();
    expect(await summary(id)).toEqual({
      matchId: id,
      type: 'match',
      finished: true,
      eventSeq: 9,
      players: [
        { ...annaLeg301, playerId: anna },
        { ...bartekLeg301, playerId: bartek },
      ],
      legs: [
        {
          legIndex: 0,
          winnerId: anna,
          checkout: 121,
          dartsThrown: 6,
          averages: [
            { playerId: anna, average: 150.5 },
            { playerId: bartek, average: 0 },
          ],
        },
      ],
      lastLegProgress: {
        legIndex: 0,
        startingScore: 301,
        players: [
          { playerId: anna, points: annaLeg301Points },
          { playerId: bartek, points: bartekLeg301Points },
        ],
      },
      checkouts: null,
    });
  });

  it('charts every dart of the LEG_301 match without a bust', async () => {
    const result = await summary(await playLeg301());
    expect(result.lastLegProgress?.players).toEqual([
      { playerId: anna, points: annaLeg301Points },
      { playerId: bartek, points: bartekLeg301Points },
    ]);
    expect(result.lastLegProgress?.players.flatMap((player) => player.points).some((p) => p.bust)).toBe(false);
  });

  it('marks a mid-turn bust and returns to the score before the turn', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, id, [T(20), T(20), T(20), MISS, MISS, MISS, S(20), T(20), T(20)]);
    const result = await summary(id);
    expect(result.lastLegProgress?.players[0]).toEqual({
      playerId: anna,
      points: [point(1, 241), point(2, 181), point(3, 121), point(4, 101), point(5, 41), point(6, 121, true)],
    });
  });

  it('drops the undone winning dart from the chart', async () => {
    const id = await playLeg301();
    expect((await undo(t.app, id)).statusCode).toBe(200);
    await throwDarts(t.app, id, [MISS]);
    const result = await summary(id);
    expect(result.finished).toBe(false);
    expect(result.lastLegProgress?.players[0]).toEqual({ playerId: anna, points: [...annaLeg301Points.slice(0, 5), point(6, 10)] });
  });

  it('charts only the last leg of a best of 3', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 3 });
    // Leg 1 zaczyna Bartek: trzy pudła, potem LEG_301 z Anną na 2:0.
    await throwDarts(t.app, id, [...LEG_301, MISS, MISS, MISS, ...LEG_301]);
    const result = await summary(id);
    expect(result.finished).toBe(true);
    expect(result.lastLegProgress).toEqual({
      legIndex: 1,
      startingScore: 301,
      players: [
        { playerId: anna, points: annaLeg301Points },
        { playerId: bartek, points: [...bartekLeg301Points, point(4, 301), point(5, 301), point(6, 301)] },
      ],
    });
  });

  it('ends each line of a casual game on the last closed dart', async () => {
    const celina = (await createPlayer(t.app, 'Celina')).id;
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    await throwDarts(t.app, id, [T(20), T(20), T(20), T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5), T(20), T(17), D(5)]);
    const result = await summary(id);
    expect(result.finished).toBe(true);
    expect(result.lastLegProgress).toEqual({
      legIndex: 0,
      startingScore: 301,
      players: [
        { playerId: anna, points: annaLeg301Points },
        { playerId: bartek, points: annaLeg301Points },
        { playerId: celina, points: bartekLeg301Points },
      ],
    });
  });

  it('gives no chart for Solo 501 and Free run', async () => {
    expect((await summary(await playSolo501())).lastLegProgress).toBeNull();
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), T(20), T(20)]);
    expect((await summary(id)).lastLegProgress).toBeNull();
  });

  it('counts the completed turns of an unfinished match and ignores the open turn', async () => {
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
    await throwDarts(t.app, id, [T(20), T(20), T(20), S(20)]);
    const result = await summary(id);
    expect(result).toMatchObject({ finished: false, eventSeq: 4, legs: [] });
    expect(result.players).toEqual([
      { ...noThrows, dartsThrown: 3, points: 180, average: 180, first9Average: 180, scores180: 1, playerId: anna },
      { ...noThrows, playerId: bartek },
    ]);
  });

  it('gives zeros and nulls for a Free run', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), T(20), T(20)]);
    expect(await summary(id)).toEqual({ matchId: id, type: 'practice', finished: false, eventSeq: 3, players: [{ ...noThrows, playerId: anna }], legs: [], lastLegProgress: null, checkouts: null });
  });

  it('lists the Solo 501 leg', async () => {
    const id = await playSolo501();
    expect(await summary(id)).toMatchObject({
      finished: true,
      players: [{ playerId: anna, average: 167, legsWon: 0 }],
      legs: [{ legIndex: 0, winnerId: anna, checkout: 141, dartsThrown: 9, averages: [{ playerId: anna, average: 167 }] }],
    });
  });

  it('answers 404 for an unknown match', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/matches/nothing/summary' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });
});
