import type { DomainEvent, Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { legDurations } from './leg-durations.js';

const START = Date.parse('2026-10-21T18:00:00.000Z');
const MISS = { segment: 0, multiplier: 0 } as Hit;
const D5 = { segment: 5, multiplier: 2 } as Hit;

// Chwila START + seconds w milisekundach.
const ms = (seconds: number): number => START + seconds * 1000;
const thrownAt = (...seconds: number[]) => seconds.map((s) => ({ receivedAt: new Date(ms(s)).toISOString() }));
const pause = (from: number, to: number) => ({ start: ms(from), end: ms(to) });

function turn(playerId: string, legIndex: number, darts: number): DomainEvent {
  return { type: 'turn_completed', playerId, legIndex, turnIndex: 0, darts: Array<Hit>(darts).fill(MISS), total: 0, remaining: 301 };
}

function checkout(playerId: string, legIndex: number): DomainEvent[] {
  return [
    { type: 'turn_completed', playerId, legIndex, turnIndex: 1, darts: [D5], total: 10, remaining: 0 },
    { type: 'leg_won', playerId, legIndex, checkout: 10, dartsThrown: 4 },
  ];
}

// Leg 0: rzutki 0-3, leg 1: rzutki 4-7, a po drugim legu koniec meczu.
const TWO_LEGS: DomainEvent[] = [
  turn('anna', 0, 3),
  ...checkout('anna', 0),
  { type: 'bust', playerId: 'bartek', legIndex: 1, turnIndex: 0, darts: [MISS, MISS, MISS], remaining: 301 },
  ...checkout('bartek', 1),
  { type: 'match_won', playerId: 'bartek', legsWon: { anna: 1, bartek: 1 } },
];

describe('legDurations', () => {
  it('times each leg from its first to its closing dart', () => {
    const durations = legDurations(TWO_LEGS, thrownAt(10, 11, 12, 20, 50, 51, 52, 80), []);
    expect([...durations]).toEqual([
      [0, 10_000],
      [1, 30_000],
    ]);
  });

  it('subtracts a pause inside a leg', () => {
    expect(legDurations(TWO_LEGS, thrownAt(10, 10, 10, 100, 200, 200, 200, 200), [pause(30, 90)]).get(0)).toBe(30_000);
  });

  it('does not subtract a pause before the first dart of a leg', () => {
    const durations = legDurations(TWO_LEGS, thrownAt(10, 10, 10, 20, 100, 100, 100, 130), [pause(0, 5), pause(40, 90)]);
    expect(durations.get(0)).toBe(10_000);
    expect(durations.get(1)).toBe(30_000);
  });

  it('does not subtract a pause after the closing dart of a leg', () => {
    const durations = legDurations(TWO_LEGS, thrownAt(10, 10, 10, 20, 100, 100, 100, 130), [pause(25, 60), pause(140, 200)]);
    expect(durations.get(0)).toBe(10_000);
    expect(durations.get(1)).toBe(30_000);
  });

  it('clips a pause that only partly overlaps a leg', () => {
    const throws = thrownAt(10, 10, 10, 40, 100, 100, 100, 160);
    // 30-60 s wystaje za koniec lega 0, 90-120 s zaczyna się przed startem lega 1.
    const durations = legDurations(TWO_LEGS, throws, [pause(30, 60), pause(90, 120)]);
    expect(durations.get(0)).toBe(20_000);
    expect(durations.get(1)).toBe(40_000);
  });

  it('gives 0 when all darts of a leg share one time', () => {
    expect(legDurations(TWO_LEGS, thrownAt(10, 10, 10, 10, 20, 20, 20, 20), []).get(0)).toBe(0);
  });

  it('gives an empty map for a casual game', () => {
    const events: DomainEvent[] = [
      turn('anna', 0, 3),
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 1, darts: [D5], total: 10, remaining: 0 },
      { type: 'player_finished', playerId: 'anna', legIndex: 0, place: 1, checkout: 10, dartsThrown: 4 },
      turn('bartek', 0, 3),
    ];
    expect(legDurations(events, thrownAt(10, 11, 12, 13, 14, 15, 16), []).size).toBe(0);
  });

  it('rejects a log with fewer throws than the darts of the events', () => {
    expect(() => legDurations(TWO_LEGS, thrownAt(10, 11, 12), [])).toThrow('Corrupt log');
  });
});
