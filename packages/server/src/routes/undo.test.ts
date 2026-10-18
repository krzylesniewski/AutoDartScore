import { ApiError, UndoResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D, LEG_301, S, T, countRows, createGame, createPlayers, getMatch, logEntries, remaining, setup, throwDarts, undo, type TestApp } from '../test-helpers.js';

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

function match301(bestOf = 3) {
  return createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf });
}

describe('POST /matches/:id/undo', () => {
  it('restores remaining and currentDarts within a turn and keeps the throws row', async () => {
    const { id } = await match301();
    const [first, second] = await throwDarts(t.app, id, [T(20), S(19)]);

    const response = await undo(t.app, id);
    expect(response.statusCode).toBe(200);
    const result = UndoResult.parse(response.json());
    expect(result.undoneThrowId).toBe(second.throw.id);
    expect(result.state).toMatchObject({ eventSeq: 3, currentPlayerId: anna, currentDarts: [{ segment: 20, multiplier: 3 }] });
    expect(remaining(result.state)).toEqual(remaining(first.state));

    expect(await countRows(t.db, 'throws')).toBe(2);
    expect(await logEntries(t.db, id)).toEqual([
      { seq: 1, type: 'throw', throw_id: first.throw.id },
      { seq: 2, type: 'throw', throw_id: second.throw.id },
      { seq: 3, type: 'undo', throw_id: second.throw.id },
    ]);
  });

  it('gives the turn back to the previous player across a turn boundary', async () => {
    const { id } = await match301();
    const results = await throwDarts(t.app, id, [T(20), T(20), S(1)]);
    expect(results[2].state.currentPlayerId).toBe(bartek);

    const result = UndoResult.parse((await undo(t.app, id)).json());
    expect(result.state).toMatchObject({
      currentPlayerId: anna,
      turnIndex: 0,
      currentDarts: [
        { segment: 20, multiplier: 3 },
        { segment: 20, multiplier: 3 },
      ],
    });
    expect(remaining(result.state)).toEqual([181, 301]);

    // Dwa cofnięcia z rzędu zdejmują kolejne rzutki.
    const again = UndoResult.parse((await undo(t.app, id)).json());
    expect(again.undoneThrowId).toBe(results[1].throw.id);
    expect(remaining(again.state)).toEqual([241, 301]);
  });

  it('reopens the game when the winning dart is undone', async () => {
    const { id } = await match301(1);
    await throwDarts(t.app, id, LEG_301);
    expect((await getMatch(t.app, id)).finished).toBe(true);

    const result = UndoResult.parse((await undo(t.app, id)).json());
    expect(result.state).toMatchObject({
      finished: false,
      winnerId: null,
      currentPlayerId: anna,
      currentDarts: [
        { segment: 20, multiplier: 3 },
        { segment: 17, multiplier: 3 },
      ],
    });
    expect(remaining(result.state)).toEqual([10, 301]);

    // Po cofnięciu gra przyjmuje kolejne rzutki.
    const [retry] = await throwDarts(t.app, id, [D(5)]);
    expect(retry.state.finished).toBe(true);
  });

  it('answers 409 nothing_to_undo on an empty log, also after undoing everything', async () => {
    const { id } = await match301();
    const empty = await undo(t.app, id);
    expect(empty.statusCode).toBe(409);
    expect(ApiError.parse(empty.json()).error).toBe('nothing_to_undo');

    await throwDarts(t.app, id, [S(20)]);
    expect((await undo(t.app, id)).statusCode).toBe(200);
    expect((await undo(t.app, id)).statusCode).toBe(409);
    expect(await logEntries(t.db, id)).toHaveLength(2);
  });

  it('ignores any body, even malformed JSON', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [S(20)]);
    const response = await t.app.inject({
      method: 'POST',
      url: `/matches/${id}/undo`,
      headers: { 'content-type': 'application/json' },
      payload: '{oops',
    });
    expect(response.statusCode).toBe(200);
  });

  it('answers an unknown match with 404', async () => {
    const response = await undo(t.app, 'nope');
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });
});
