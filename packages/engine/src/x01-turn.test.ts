import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { EngineError } from './errors.js';
import { applyX01Dart, type X01Turn } from './x01-turn.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 });
const D = (n: number): Hit => ({ segment: n, multiplier: 2 });
const T = (n: number): Hit => ({ segment: n, multiplier: 3 });
const BULL: Hit = { segment: 25, multiplier: 2 };

// Początek tury z zadanym wynikiem.
function turnAt(score: number, currentDarts: readonly Hit[] = [], remaining = score): X01Turn {
  return { playerId: 'anna', legIndex: 1, turnIndex: 4, remaining, turnStartRemaining: score, currentDarts };
}

describe('applyX01Dart', () => {
  it('keeps the turn open before the third dart', () => {
    expect(applyX01Dart(turnAt(301, [T(20)], 241), S(5))).toEqual({ outcome: 'open', remaining: 236, darts: [T(20), S(5)] });
  });

  it('completes the turn on the third dart', () => {
    expect(applyX01Dart(turnAt(301, [T(20), T(20)], 181), T(19))).toEqual({
      outcome: 'turn_completed',
      remaining: 124,
      event: {
        type: 'turn_completed',
        playerId: 'anna',
        legIndex: 1,
        turnIndex: 4,
        darts: [T(20), T(20), T(19)],
        total: 177,
        remaining: 124,
      },
    });
  });

  it('busts below zero and returns to the score before the turn', () => {
    expect(applyX01Dart(turnAt(40, [S(20)], 20), T(20))).toEqual({
      outcome: 'bust',
      remaining: 40,
      event: { type: 'bust', playerId: 'anna', legIndex: 1, turnIndex: 4, darts: [S(20), T(20)], remaining: 40 },
    });
  });

  it('busts when exactly 1 would be left', () => {
    expect(applyX01Dart(turnAt(41), D(20))).toMatchObject({ outcome: 'bust', remaining: 41, event: { type: 'bust', darts: [D(20)] } });
  });

  it('busts on zero without a double', () => {
    expect(applyX01Dart(turnAt(40, [S(20)], 20), S(20))).toMatchObject({ outcome: 'bust', remaining: 40 });
  });

  it('checks out on a double with the score before the turn as the checkout', () => {
    expect(applyX01Dart(turnAt(60, [S(20)], 40), D(20))).toEqual({
      outcome: 'checkout',
      checkout: 60,
      event: { type: 'turn_completed', playerId: 'anna', legIndex: 1, turnIndex: 4, darts: [S(20), D(20)], total: 60, remaining: 0 },
    });
  });

  it('checks out on Bull with the third dart', () => {
    expect(applyX01Dart(turnAt(121, [T(20), S(11)], 50), BULL)).toMatchObject({
      outcome: 'checkout',
      checkout: 121,
      event: { type: 'turn_completed', darts: [T(20), S(11), BULL], total: 121, remaining: 0 },
    });
  });

  it('checks out on the first dart of a turn', () => {
    expect(applyX01Dart(turnAt(32), D(16))).toMatchObject({
      outcome: 'checkout',
      checkout: 32,
      event: { type: 'turn_completed', darts: [D(16)], total: 32, remaining: 0 },
    });
  });

  it('rejects an invalid hit with invalid_hit', () => {
    const invalid = { segment: 25, multiplier: 3 } as unknown as Hit;
    expect(() => applyX01Dart(turnAt(301), invalid)).toThrow(new EngineError('invalid_hit', 'Invalid hit: {"segment":25,"multiplier":3}'));
    expect(() => applyX01Dart(turnAt(301), invalid)).toThrow(expect.objectContaining({ code: 'invalid_hit' }));
  });

  it('throws a RangeError for a fourth dart in a turn', () => {
    expect(() => applyX01Dart(turnAt(301, [S(1), S(1), S(1)], 298), S(1))).toThrow(RangeError);
  });
});
