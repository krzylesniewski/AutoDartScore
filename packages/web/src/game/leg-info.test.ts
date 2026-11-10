import { describe, expect, it } from 'vitest';
import { casual, legTurn, player, snapshot } from '../test/snapshots';
import { knockedOff, lastTurnOf, legStats } from './leg-info';

const T20 = { segment: 20, multiplier: 3 } as const;
const S20 = { segment: 20, multiplier: 1 } as const;

describe('knockedOff', () => {
  it('is zero before the first closed turn', () => {
    expect(knockedOff([], 'p1')).toEqual({ points: 0, turns: 0 });
  });

  it("sums the player's closed turns and counts a bust as a turn without points", () => {
    const turns = [
      legTurn('p1', { points: 60, remainingAfter: 441 }),
      legTurn('p2', { points: 100, remainingAfter: 401 }),
      legTurn('p1', { points: 71, remainingAfter: 370 }),
      legTurn('p1', { bust: true, remainingAfter: 370 }),
    ];
    expect(knockedOff(turns, 'p1')).toEqual({ points: 131, turns: 3 });
    expect(knockedOff(turns, 'p2')).toEqual({ points: 100, turns: 1 });
  });

  it('counts the closing turn of a placed casual player', () => {
    const turns = [legTurn('p1', { points: 140, remainingAfter: 0 }), legTurn('p2', { points: 26, remainingAfter: 115 })];
    expect(knockedOff(turns, 'p1')).toEqual({ points: 140, turns: 1 });
  });
});

describe('lastTurnOf', () => {
  it('is null before the first closed turn', () => {
    expect(lastTurnOf([legTurn('p2')], 'p1')).toBeNull();
  });

  it("returns the player's last closed turn, a bust included", () => {
    const bust = legTurn('p1', { bust: true, remainingAfter: 441 });
    expect(lastTurnOf([legTurn('p1'), legTurn('p2'), bust], 'p1')).toBe(bust);
  });
});

describe('legStats', () => {
  it('is empty for an empty leg', () => {
    expect(legStats(snapshot())).toEqual({ highest: null, darts: 0, busts: 0 });
  });

  it('counts the darts of the open turn', () => {
    expect(legStats(snapshot({ currentDarts: [T20, S20] }))).toEqual({ highest: null, darts: 2, busts: 0 });
  });

  it('counts a bust and never takes it as the highest turn', () => {
    const state = snapshot({
      legTurns: [legTurn('p1', { points: 45, remainingAfter: 456 }), legTurn('p2', { bust: true, darts: [T20, T20], remainingAfter: 501 })],
      currentDarts: [S20],
    });
    expect(legStats(state)).toEqual({ highest: { points: 45, playerId: 'p1' }, darts: 6, busts: 1 });
  });

  it('has no highest turn when every turn is a bust', () => {
    expect(legStats(snapshot({ legTurns: [legTurn('p1', { bust: true })] })).highest).toBeNull();
  });

  it('keeps the earliest turn on a tie for the highest', () => {
    const state = snapshot({
      legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 }), legTurn('p2', { points: 100, remainingAfter: 401 }), legTurn('p1', { points: 100, remainingAfter: 341 })],
    });
    expect(legStats(state).highest).toEqual({ points: 100, playerId: 'p2' });
  });

  it('counts the closing turn of a placed casual player', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      currentPlayerId: 'p2',
      players: [player('p1', 'Anna', { place: 1, remaining: 0 }), player('p2', 'Bartek'), player('p3', 'Celina')],
      legTurns: [legTurn('p1', { points: 121, remainingAfter: 0, darts: [T20, S20, { segment: 16, multiplier: 2 }] }), legTurn('p2', { points: 26, remainingAfter: 475 })],
    });
    expect(legStats(state)).toEqual({ highest: { points: 121, playerId: 'p1' }, darts: 6, busts: 0 });
  });

  it('counts the approaches of a Free run, where no score is left', () => {
    const state = snapshot({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      players: [player('p1', 'Anna', { remaining: null })],
      legTurns: [legTurn('p1', { points: 85, remainingAfter: null, turnIndex: 0 }), legTurn('p1', { points: 26, remainingAfter: null, turnIndex: 1 })],
      currentDarts: [S20],
    });
    expect(legStats(state)).toEqual({ highest: { points: 85, playerId: 'p1' }, darts: 7, busts: 0 });
    expect(knockedOff(state.legTurns, 'p1')).toEqual({ points: 111, turns: 2 });
  });
});
