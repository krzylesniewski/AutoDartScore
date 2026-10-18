import { describe, expect, it } from 'vitest';
import { DomainEvent } from './index.js';

describe('DomainEvent', () => {
  it('parses each event type', () => {
    const events = [
      { type: 'turn_completed', playerId: 'p1', legIndex: 0, turnIndex: 0, darts: [{ segment: 20, multiplier: 3 }], total: 60, remaining: 441 },
      { type: 'bust', playerId: 'p1', legIndex: 0, turnIndex: 5, darts: [{ segment: 20, multiplier: 1 }], remaining: 16 },
      { type: 'leg_won', playerId: 'p1', legIndex: 0, checkout: 40, dartsThrown: 15 },
      { type: 'match_won', playerId: 'p1', legsWon: { p1: 2, p2: 1 } },
      { type: 'player_finished', playerId: 'p1', legIndex: 0, place: 1, checkout: 40, dartsThrown: 18 },
      {
        type: 'casual_finished',
        placements: [
          { playerId: 'p1', place: 1 },
          { playerId: 'p2', place: 2 },
          { playerId: 'p3', place: 3 },
        ],
      },
    ];
    for (const event of events) {
      expect(DomainEvent.parse(event)).toEqual(event);
    }
  });

  it('rejects an unknown event type', () => {
    expect(DomainEvent.safeParse({ type: 'unknown', playerId: 'p1', legIndex: 0 }).success).toBe(false);
  });

  it('rejects a turn with more than 3 darts', () => {
    const dart = { segment: 1, multiplier: 1 };
    expect(
      DomainEvent.safeParse({ type: 'turn_completed', playerId: 'p1', legIndex: 0, turnIndex: 0, darts: [dart, dart, dart, dart], total: 4, remaining: 497 }).success,
    ).toBe(false);
  });

  it.each([0, 5])('rejects player_finished with place %i', (place) => {
    expect(DomainEvent.safeParse({ type: 'player_finished', playerId: 'p1', legIndex: 0, place, checkout: 40, dartsThrown: 18 }).success).toBe(false);
  });

  it('rejects casual_finished with a single placement', () => {
    expect(DomainEvent.safeParse({ type: 'casual_finished', placements: [{ playerId: 'p1', place: 1 }] }).success).toBe(false);
  });
});
