import type { Bust, CasualFinished, DomainEvent, Hit, LegWon, MatchWon, PlayerFinished, TurnCompleted } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { soundEffectFor } from './index.js';

const T20: Hit = { segment: 20, multiplier: 3 };
const D20: Hit = { segment: 20, multiplier: 2 };

const turn = (total: number, darts: Hit[] = [T20, T20, T20]): TurnCompleted => ({
  type: 'turn_completed',
  playerId: 'anna',
  legIndex: 0,
  turnIndex: 4,
  darts,
  total,
  remaining: 0,
});
const legWon: LegWon = { type: 'leg_won', playerId: 'anna', legIndex: 0, checkout: 40, dartsThrown: 15 };
const matchWon: MatchWon = { type: 'match_won', playerId: 'anna', legsWon: { anna: 2, bartek: 1 } };
const bust: Bust = { type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 4, darts: [T20], remaining: 40 };
const finished = (place: number): PlayerFinished => ({ type: 'player_finished', playerId: 'anna', legIndex: 0, place, checkout: 40, dartsThrown: 15 });
const casualFinished: CasualFinished = {
  type: 'casual_finished',
  placements: [
    { playerId: 'bartek', place: 1 },
    { playerId: 'anna', place: 2 },
    { playerId: 'celina', place: 3 },
  ],
};

describe('soundEffectFor', () => {
  it('plays the long fanfare on the deciding 1v1 checkout', () => {
    const events: DomainEvent[] = [turn(40, [D20]), legWon, matchWon];
    expect(soundEffectFor(events)).toBe('fanfare_long');
  });

  it('plays the short fanfare on a leg checkout that does not end the match', () => {
    expect(soundEffectFor([turn(40, [D20]), legWon])).toBe('fanfare_short');
  });

  it('plays the long fanfare for the first casual place', () => {
    expect(soundEffectFor([turn(40, [D20]), finished(1)])).toBe('fanfare_long');
  });

  it('plays the short fanfare for the second casual place that ends the game', () => {
    expect(soundEffectFor([turn(40, [D20]), finished(2), casualFinished])).toBe('fanfare_short');
  });

  it('plays the short fanfare on a Solo 501 checkout', () => {
    expect(soundEffectFor([turn(100, [T20, D20]), legWon])).toBe('fanfare_short');
  });

  it('plays the bust effect on a bust', () => {
    expect(soundEffectFor([bust])).toBe('bust');
  });

  it('plays nothing on a plain turn', () => {
    expect(soundEffectFor([turn(180)])).toBeNull();
  });

  it('plays nothing without domain events', () => {
    expect(soundEffectFor([])).toBeNull();
  });
});
