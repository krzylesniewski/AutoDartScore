import { describe, expect, it } from 'vitest';
import { casual, legTurn, player, snapshot } from '../test/snapshots';
import { turnHistory } from './turn-history';

function turn(remainingAfter: number, points: number, place: number | null = null) {
  return { kind: 'turn', remainingAfter, points, bust: false, place };
}

const CURRENT = { kind: 'current' };
const EMPTY = { kind: 'empty' };
const OUT = { kind: 'out' };

describe('turnHistory', () => {
  it('has one empty current row for the thrower before the first turn', () => {
    const model = turnHistory(snapshot());
    expect(model.columns.map((column) => column.id)).toEqual(['p1', 'p2']);
    expect(model.rows).toEqual([[CURRENT, EMPTY]]);
    expect(model.currentRow).toBe(0);
  });

  it('puts the r-th turn of each player in row r, the second player one turn behind', () => {
    const state = snapshot({
      currentPlayerId: 'p2',
      legTurns: [
        legTurn('p1', { points: 60, remainingAfter: 441 }),
        legTurn('p2', { points: 81, remainingAfter: 420 }),
        legTurn('p1', { points: 26, remainingAfter: 415 }),
      ],
    });
    const model = turnHistory(state);
    expect(model.rows).toEqual([
      [turn(441, 60), turn(420, 81)],
      [turn(415, 26), CURRENT],
    ]);
    expect(model.currentRow).toBe(1);
  });

  it('keeps a bust with the score before the turn and no points', () => {
    const state = snapshot({
      currentPlayerId: 'p1',
      legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 }), legTurn('p2', { bust: true, remainingAfter: 501 })],
    });
    const model = turnHistory(state);
    expect(model.rows[0]?.[1]).toEqual({ kind: 'turn', remainingAfter: 501, points: 0, bust: true, place: null });
    expect(model.rows[1]).toEqual([CURRENT, EMPTY]);
  });

  it('starts the columns from the leg starter in the second leg of a 1v1', () => {
    const state = snapshot({
      legIndex: 1,
      currentPlayerId: 'p1',
      legTurns: [legTurn('p2', { points: 100, remainingAfter: 401 })],
    });
    const model = turnHistory(state);
    expect(model.columns.map((column) => column.id)).toEqual(['p2', 'p1']);
    expect(model.rows).toEqual([[turn(401, 100), CURRENT]]);
  });

  it('starts from the thrower when the leg has no closed turn yet', () => {
    const model = turnHistory(snapshot({ legIndex: 1, currentPlayerId: 'p2' }));
    expect(model.columns.map((column) => column.id)).toEqual(['p2', 'p1']);
    expect(model.rows).toEqual([[CURRENT, EMPTY]]);
  });

  it('gives the place to the closing turn of a casual player and marks the rows after it out of the queue', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      currentPlayerId: 'p2',
      players: [player('p1', 'Anna', { place: 1, remaining: 0 }), player('p2', 'Bartek', { remaining: 200 }), player('p3', 'Celina', { remaining: 300 })],
      legTurns: [
        legTurn('p1', { points: 100, remainingAfter: 401 }),
        legTurn('p2', { points: 60, remainingAfter: 441 }),
        legTurn('p3', { points: 41, remainingAfter: 460 }),
        legTurn('p1', { points: 140, remainingAfter: 0 }),
        legTurn('p2', { points: 81, remainingAfter: 360 }),
        legTurn('p3', { points: 60, remainingAfter: 400 }),
        legTurn('p2', { points: 100, remainingAfter: 260 }),
        legTurn('p3', { points: 100, remainingAfter: 300 }),
      ],
    });
    const model = turnHistory(state);
    expect(model.rows).toEqual([
      [turn(401, 100), turn(441, 60), turn(460, 41)],
      [turn(0, 140, 1), turn(360, 81), turn(400, 60)],
      [OUT, turn(260, 100), turn(300, 100)],
      [OUT, CURRENT, EMPTY],
    ]);
    expect(model.currentRow).toBe(3);
  });

  it('is empty without a closed turn and without a thrower', () => {
    const model = turnHistory(snapshot({ currentPlayerId: null }));
    expect(model.rows).toEqual([]);
    expect(model.currentRow).toBeNull();
  });

  it('has no current row in an abandoned game', () => {
    const state = snapshot({
      status: 'abandoned',
      currentPlayerId: 'p2',
      legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 })],
    });
    const model = turnHistory(state);
    expect(model.currentRow).toBeNull();
    expect(model.rows).toEqual([[turn(441, 60), EMPTY]]);
  });
});
