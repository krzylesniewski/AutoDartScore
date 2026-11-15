import { replayGame, type GameConfig } from '@autoscore/engine';
import type { Hit, ThrowRecord } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { buildLegTurns } from './leg-turns.js';

const S = (segment: number): Hit => ({ segment, multiplier: 1 }) as Hit;
const D = (segment: number): Hit => ({ segment, multiplier: 2 }) as Hit;
const T = (segment: number): Hit => ({ segment, multiplier: 3 }) as Hit;
const MISS = { segment: 0, multiplier: 0 } as Hit;

const LEG: readonly Hit[] = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];

function match(legsToWin: number): GameConfig {
  return { type: 'match', playerIds: ['anna', 'bartek'], startingScore: 301, legsToWin, firstPlayerIndex: 0 };
}

function turns(config: GameConfig, hits: readonly Hit[]) {
  const { state, events } = replayGame(config, hits);
  return buildLegTurns(state, events, hits);
}

describe('buildLegTurns', () => {
  it('lists the closed turns of a 1v1 leg in throw order', () => {
    expect(turns(match(1), [T(20), T(20), T(20), MISS, MISS, MISS, S(1)])).toEqual([
      { playerId: 'anna', turnIndex: 0, darts: [T(20), T(20), T(20)], points: 180, remainingAfter: 121, bust: false },
      { playerId: 'bartek', turnIndex: 1, darts: [MISS, MISS, MISS], points: 0, remainingAfter: 301, bust: false },
    ]);
  });

  it('gives a bust 0 points and the score before the turn', () => {
    const hits = [T(20), T(20), T(20), S(1), S(1), S(1), T(20), T(20)];
    expect(turns(match(1), hits).at(-1)).toEqual({
      playerId: 'anna',
      turnIndex: 2,
      darts: [T(20), T(20)],
      points: 0,
      remainingAfter: 121,
      bust: true,
    });
  });

  it('starts the next leg of a best of 3 with no turns', () => {
    expect(turns(match(2), LEG)).toEqual([]);
  });

  it('keeps the last leg with the winning turn after the match ends', () => {
    const result = turns(match(1), LEG);
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ playerId: 'anna', turnIndex: 2, darts: [T(20), T(17), D(5)], points: 121, remainingAfter: 0, bust: false });
  });

  it('keeps the turns of a casual player who already finished', () => {
    const config: GameConfig = { type: 'casual', playerIds: ['anna', 'bartek', 'celina'], startingScore: 301, firstPlayerIndex: 0 };
    const hits = [T(20), T(20), T(20), MISS, MISS, MISS, MISS, MISS, MISS, T(20), T(17), D(5), S(20), S(20), S(20)];
    const result = turns(config, hits);
    expect(result.map((turn) => [turn.playerId, turn.turnIndex, turn.remainingAfter])).toEqual([
      ['anna', 0, 121],
      ['bartek', 1, 301],
      ['celina', 2, 301],
      ['anna', 3, 0],
      ['bartek', 4, 241],
    ]);
  });

  it('lists the turns of Solo 501', () => {
    const config: GameConfig = { type: 'practice', practiceMode: 'solo_501', playerId: 'anna' };
    expect(turns(config, [T(20), T(20), T(20), S(5)])).toEqual([
      { playerId: 'anna', turnIndex: 0, darts: [T(20), T(20), T(20)], points: 180, remainingAfter: 321, bust: false },
    ]);
  });

  it('groups free run darts into full visits and leaves the open one out', () => {
    const config: GameConfig = { type: 'practice', practiceMode: 'free_run', playerId: 'anna' };
    expect(turns(config, [S(20), S(20), S(20), T(20), MISS, S(5), D(10)])).toEqual([
      { playerId: 'anna', turnIndex: 0, darts: [S(20), S(20), S(20)], points: 60, remainingAfter: null, bust: false },
      { playerId: 'anna', turnIndex: 1, darts: [T(20), MISS, S(5)], points: 65, remainingAfter: null, bust: false },
    ]);
  });

  it('gives no turns in checkout practice', () => {
    const config: GameConfig = { type: 'practice', practiceMode: 'checkouts', playerId: 'anna', range: '2-50', seed: 1, rule: 'repeat_on_miss' };
    const { state, events } = replayGame(config, [], [{ type: 'attempt', success: true }]);
    expect(buildLegTurns(state, events, [])).toEqual([]);
  });

  it('copies only the segment and multiplier of free run throw records', () => {
    const config: GameConfig = { type: 'practice', practiceMode: 'free_run', playerId: 'anna' };
    const records: ThrowRecord[] = [S(20), T(20), MISS].map((hit, index) => ({
      id: `t${index}`,
      matchId: 'm1',
      eventId: '4b8e7a61-2c0f-4f5e-9d1a-6c3b2a1f0e9d',
      source: 'keypad',
      sequence: index,
      ...hit,
      confidence: 1,
      detectedAt: '2026-10-15T18:30:12.345Z',
      receivedAt: '2026-10-15T18:30:12.400Z',
    }));
    const { state, events } = replayGame(config, records);
    const [turn] = buildLegTurns(state, events, records);
    expect(turn?.darts).toStrictEqual([S(20), T(20), MISS]);
    turn?.darts.forEach((dart) => expect(Object.keys(dart)).toEqual(['segment', 'multiplier']));
  });
});
