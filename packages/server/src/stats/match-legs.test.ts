import { replayGame, type GameConfig } from '@autoscore/engine';
import { MatchLeg, type Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { buildMatchLegs } from './match-legs.js';
import { tallyGame } from './tally.js';

const S = (segment: number): Hit => ({ segment, multiplier: 1 });
const D = (segment: number): Hit => ({ segment, multiplier: 2 });
const T = (segment: number): Hit => ({ segment, multiplier: 3 });
const MISS = { segment: 0, multiplier: 0 } as Hit;

// Zaczynający leg kończy 301 w drugiej turze (180, potem 121), drugi gracz pudłuje.
const LEG: readonly Hit[] = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];

function legs(legsToWin: number, hits: readonly Hit[], firstPlayerIndex: 0 | 1 = 0) {
  const config: GameConfig = { type: 'match', playerIds: ['anna', 'bartek'], startingScore: 301, legsToWin, firstPlayerIndex };
  const { state, events } = replayGame(config, hits);
  if (state.type !== 'match') {
    throw new Error('expected a 1v1 match');
  }
  return { result: buildMatchLegs(state.state, events), events };
}

describe('buildMatchLegs', () => {
  it('gives one empty leg 0 before the first dart', () => {
    expect(legs(1, []).result).toEqual([
      {
        legIndex: 0,
        starterId: 'anna',
        winnerId: null,
        checkout: null,
        dartsThrown: null,
        players: [
          { playerId: 'anna', darts: 0, average: null },
          { playerId: 'bartek', darts: 0, average: null },
        ],
        turns: [],
      },
    ]);
  });

  it('describes a won leg with its closed turns and leg averages', () => {
    const [leg] = legs(1, LEG).result;
    expect(MatchLeg.parse(leg)).toEqual(leg);
    expect(leg).toMatchObject({
      legIndex: 0,
      starterId: 'anna',
      winnerId: 'anna',
      checkout: 121,
      dartsThrown: 6,
      players: [
        { playerId: 'anna', darts: 6, average: 150.5 },
        { playerId: 'bartek', darts: 3, average: 0 },
      ],
    });
    expect(leg?.turns.map((turn) => [turn.turnIndex, turn.points, turn.remainingAfter])).toEqual([
      [0, 180, 121],
      [1, 0, 301],
      [2, 121, 0],
    ]);
  });

  it('alternates the starter and leaves the open turn of the current leg out', () => {
    const { result } = legs(2, [...LEG, MISS, MISS, MISS, S(20)], 1);
    expect(result.map((leg) => [leg.legIndex, leg.starterId, leg.winnerId])).toEqual([
      [0, 'bartek', 'bartek'],
      [1, 'anna', null],
    ]);
    expect(result[1]?.turns).toEqual([
      { playerId: 'anna', turnIndex: 0, darts: [MISS, MISS, MISS], points: 0, remainingAfter: 301, bust: false },
    ]);
    expect(result[1]?.players).toEqual([
      { playerId: 'anna', darts: 3, average: 0 },
      { playerId: 'bartek', darts: 0, average: null },
    ]);
  });

  it('starts the next leg with no turns right after a won leg', () => {
    const { result } = legs(2, LEG);
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ legIndex: 1, starterId: 'bartek', winnerId: null, checkout: null, dartsThrown: null, turns: [] });
  });

  it('counts the darts of a bust with 0 points', () => {
    const { result } = legs(1, [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(20)]);
    expect(result[0]?.turns.at(-1)).toEqual({
      playerId: 'anna',
      turnIndex: 2,
      darts: [T(20), T(20)],
      points: 0,
      remainingAfter: 121,
      bust: true,
    });
    expect(result[0]?.players[0]).toEqual({ playerId: 'anna', darts: 5, average: 108 });
  });

  it('keeps the last leg after the match is won and matches the leg averages of the summary', () => {
    const second: Hit[] = [MISS, MISS, MISS, T(20), T(20), T(20), MISS, MISS, S(1), T(20), T(17), D(5)];
    const { result, events } = legs(2, [...LEG, ...second]);
    expect(result.map((leg) => [leg.starterId, leg.winnerId, leg.dartsThrown])).toEqual([
      ['anna', 'anna', 6],
      ['bartek', 'anna', 6],
    ]);
    const summary = tallyGame('match', ['anna', 'bartek'], events).legs;
    expect(summary).toHaveLength(2);
    for (const leg of summary) {
      expect(result[leg.legIndex]?.players.map(({ playerId, average }) => ({ playerId, average }))).toEqual(leg.averages);
    }
  });
});
