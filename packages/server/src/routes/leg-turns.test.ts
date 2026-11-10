import { MatchSnapshot, UndoResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkoutAttempt,
  createGame,
  createPlayers,
  D,
  getMatch,
  LEG_301,
  MISS,
  S,
  setup,
  T,
  throwDarts,
  undo,
  type Dart,
  type TestApp,
} from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

const hit = ([segment, multiplier]: Dart) => ({ segment, multiplier });
const hits = (darts: readonly Dart[]) => darts.map(hit);

async function match301(bestOf = 1) {
  const [anna = '', bartek = ''] = await createPlayers(t.app, 2);
  const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf });
  return { id, anna, bartek };
}

async function practice(practiceMode: 'free_run' | 'solo_501') {
  const [anna = ''] = await createPlayers(t.app, 1);
  const { id } = await createGame(t.app, { type: 'practice', practiceMode, playerIds: [anna] });
  return { id, anna };
}

// Stan z odpowiedzi na ostatnią rzutkę.
async function throwAll(matchId: string, darts: readonly Dart[]): Promise<MatchSnapshot> {
  const results = await throwDarts(t.app, matchId, darts);
  return MatchSnapshot.parse(results.at(-1)?.state);
}

async function undoOk(matchId: string): Promise<MatchSnapshot> {
  const response = await undo(t.app, matchId);
  expect(response.statusCode).toBe(200);
  return UndoResult.parse(response.json()).state;
}

describe('legTurns in the match snapshot', () => {
  it('lists two closed turns of two players', async () => {
    const { id, anna, bartek } = await match301();
    const state = await throwAll(id, [T(20), T(20), T(20), MISS, MISS, MISS]);
    expect(state.legTurns).toEqual([
      { playerId: anna, turnIndex: 0, darts: hits([T(20), T(20), T(20)]), points: 180, remainingAfter: 121, bust: false },
      { playerId: bartek, turnIndex: 1, darts: hits([MISS, MISS, MISS]), points: 0, remainingAfter: 301, bust: false },
    ]);
    expect(state.currentDarts).toEqual([]);
  });

  it('leaves the open turn out of the list', async () => {
    const { id } = await match301();
    const state = await throwAll(id, [T(20), T(20), T(20), MISS, MISS, MISS, T(20)]);
    expect(state.legTurns).toHaveLength(2);
    expect(state.currentDarts).toEqual(hits([T(20)]));
  });

  it('gives a bust 0 points and the score before the turn', async () => {
    const { id, anna } = await match301();
    const state = await throwAll(id, [T(20), T(20), T(20), S(1), S(1), S(1), T(20), T(20)]);
    expect(state.legTurns).toHaveLength(3);
    expect(state.legTurns[2]).toEqual({ playerId: anna, turnIndex: 2, darts: hits([T(20), T(20)]), points: 0, remainingAfter: 121, bust: true });
  });

  it('removes the turn when its last dart is undone', async () => {
    const { id } = await match301();
    await throwAll(id, [T(20), T(20), T(20)]);
    const state = await undoOk(id);
    expect(state.legTurns).toEqual([]);
    expect(state.currentDarts).toEqual(hits([T(20), T(20)]));
  });

  it('recomputes the turn after an undo and a different throw', async () => {
    const { id, anna } = await match301();
    await throwAll(id, [T(20), T(20), T(20)]);
    await undoOk(id);
    const state = await throwAll(id, [S(1)]);
    expect(state.legTurns).toEqual([
      { playerId: anna, turnIndex: 0, darts: hits([T(20), T(20), S(1)]), points: 121, remainingAfter: 180, bust: false },
    ]);
  });

  it('starts a new leg with an empty list and restores the old leg on undo', async () => {
    const { id } = await match301(3);
    const next = await throwAll(id, LEG_301);
    expect(next.legIndex).toBe(1);
    expect(next.legTurns).toEqual([]);

    const restored = await undoOk(id);
    expect(restored.legIndex).toBe(0);
    expect(restored.legTurns).toHaveLength(2);
    expect(restored.currentDarts).toEqual(hits([T(20), T(17)]));
  });

  it('keeps the last leg with the winning turn after the match ends', async () => {
    const { id, anna } = await match301();
    const state = await throwAll(id, LEG_301);
    expect(state.finished).toBe(true);
    expect(state.legTurns).toHaveLength(3);
    expect(state.legTurns[2]).toMatchObject({ playerId: anna, points: 121, remainingAfter: 0, bust: false });
  });

  it('keeps the turns of a casual player who finished and goes on with the others', async () => {
    const [anna = '', bartek = '', celina = ''] = await createPlayers(t.app, 3);
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    const state = await throwAll(id, [T(20), T(20), T(20), MISS, MISS, MISS, MISS, MISS, MISS, T(20), T(17), D(5), S(20), S(20), S(20)]);
    expect(state.placements).toEqual([{ playerId: anna, place: 1 }]);
    expect(state.legTurns.map((turn) => turn.playerId)).toEqual([anna, bartek, celina, anna, bartek]);
    expect(state.legTurns[3]).toMatchObject({ playerId: anna, points: 121, remainingAfter: 0 });
    expect(state.legTurns[4]).toMatchObject({ playerId: bartek, points: 60, remainingAfter: 241 });
  });

  it('groups free run darts into full visits without a remaining score', async () => {
    const { id, anna } = await practice('free_run');
    const state = await throwAll(id, [S(20), S(20), S(20), T(20), MISS, S(5), D(10)]);
    expect(state.legTurns).toEqual([
      { playerId: anna, turnIndex: 0, darts: hits([S(20), S(20), S(20)]), points: 60, remainingAfter: null, bust: false },
      { playerId: anna, turnIndex: 1, darts: hits([T(20), MISS, S(5)]), points: 65, remainingAfter: null, bust: false },
    ]);
    expect(state.currentDarts).toEqual(hits([D(10)]));
  });

  it('lists the turns of Solo 501', async () => {
    const { id, anna } = await practice('solo_501');
    const state = await throwAll(id, [T(20), T(20), T(20)]);
    expect(state.legTurns).toEqual([
      { playerId: anna, turnIndex: 0, darts: hits([T(20), T(20), T(20)]), points: 180, remainingAfter: 321, bust: false },
    ]);
  });

  it('has no turns in checkout practice', async () => {
    const [anna = ''] = await createPlayers(t.app, 1);
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'checkouts', playerIds: [anna], checkoutRange: '2-50' });
    const response = await checkoutAttempt(t.app, id, true);
    expect(response.statusCode).toBe(201);
    const state = MatchSnapshot.parse(response.json());
    expect(state.checkouts?.attempts).toBe(1);
    expect(state.legTurns).toEqual([]);
  });

  it('adds up to the remaining score of each player', async () => {
    const { id } = await match301();
    const state = await throwAll(id, [T(20), T(20), T(20), S(20), S(5), S(1), T(20), T(20), T(19), T(19), T(19)]);
    expect(state.currentDarts).toEqual([]);
    expect(state.legTurns.some((turn) => turn.bust)).toBe(true);
    for (const player of state.players) {
      const scored = state.legTurns.filter((turn) => turn.playerId === player.id).reduce((sum, turn) => sum + turn.points, 0);
      expect(301 - scored).toBe(player.remaining);
    }
  });

  it('gives the same list in GET /matches/:id as in the last throw response', async () => {
    const { id } = await match301();
    const state = await throwAll(id, [T(20), T(20), T(20), MISS, MISS, MISS, S(5)]);
    expect((await getMatch(t.app, id)).legTurns).toEqual(state.legTurns);
  });
});
