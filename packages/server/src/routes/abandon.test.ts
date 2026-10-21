import { ApiError, LiveMessage, MatchSnapshot, UndoResult } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  D,
  LEG_301,
  MISS,
  S,
  T,
  abandon,
  countRows,
  createGame,
  createPlayer,
  createPlayers,
  getMatch,
  hitEvent,
  logEntries,
  postThrow,
  remaining,
  resume,
  setup,
  throwDarts,
  undo,
  type TestApp,
} from '../test-helpers.js';

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

async function abandonOk(matchId: string, payload: object): Promise<MatchSnapshot> {
  const response = await abandon(t.app, matchId, payload);
  expect(response.statusCode).toBe(200);
  return MatchSnapshot.parse(response.json());
}

async function resumeOk(matchId: string): Promise<MatchSnapshot> {
  const response = await resume(t.app, matchId);
  expect(response.statusCode).toBe(200);
  return MatchSnapshot.parse(response.json());
}

function errorCode(response: { json(): unknown }): string {
  return ApiError.parse(response.json()).error;
}

describe('POST /matches/:id/abandon', () => {
  it('abandons mid-turn and records who, when and why', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [T(20), S(19)]);
    const throwsBefore = await countRows(t.db, 'throws');

    const state = await abandonOk(id, { playerId: anna, reason: '  koniec prądu ' });
    expect(state).toMatchObject({
      status: 'abandoned',
      finished: false,
      eventSeq: 3,
      currentPlayerId: anna,
      abandonment: { playerId: anna, reason: 'koniec prądu' },
    });
    expect(Date.parse(state.abandonment?.at ?? '')).not.toBeNaN();
    expect((await logEntries(t.db, id)).at(-1)).toEqual({ seq: 3, type: 'match_abandoned', throw_id: null, player_id: anna, reason: 'koniec prądu' });
    expect(await countRows(t.db, 'throws')).toBe(throwsBefore);
    expect(await getMatch(t.app, id)).toEqual(state);
  });

  it('stores a missing reason as null', async () => {
    const { id } = await match301();
    const state = await abandonOk(id, { playerId: bartek });
    expect(state.abandonment).toMatchObject({ playerId: bartek, reason: null });
    expect((await logEntries(t.db, id)).at(-1)).toMatchObject({ type: 'match_abandoned', player_id: bartek, reason: null });
  });

  it('rejects throws and undo on an abandoned game but answers a resent eventId', async () => {
    const { id } = await match301();
    const earlier = hitEvent(id, S(20));
    expect((await postThrow(t.app, id, earlier)).statusCode).toBe(201);
    await abandonOk(id, { playerId: anna });
    const entries = await logEntries(t.db, id);

    const fresh = await postThrow(t.app, id, hitEvent(id, S(5)));
    expect(fresh.statusCode).toBe(409);
    expect(errorCode(fresh)).toBe('match_abandoned');

    const resent = await postThrow(t.app, id, earlier);
    expect(resent.statusCode).toBe(200);
    expect(resent.json()).toMatchObject({ events: [], state: { status: 'abandoned' } });

    const undone = await undo(t.app, id);
    expect(undone.statusCode).toBe(409);
    expect(errorCode(undone)).toBe('match_abandoned');

    expect(await logEntries(t.db, id)).toEqual(entries);
    expect(await countRows(t.db, 'throws')).toBe(1);
  });

  it('answers 409 match_finished for a finished game', async () => {
    const { id } = await match301(1);
    await throwDarts(t.app, id, LEG_301);
    const response = await abandon(t.app, id, { playerId: anna });
    expect(response.statusCode).toBe(409);
    expect(errorCode(response)).toBe('match_finished');
  });

  it('answers 409 match_abandoned when repeated', async () => {
    const { id } = await match301();
    await abandonOk(id, { playerId: anna });
    const response = await abandon(t.app, id, { playerId: bartek });
    expect(response.statusCode).toBe(409);
    expect(errorCode(response)).toBe('match_abandoned');
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });

  it('answers 400 not_a_participant for another player', async () => {
    const celina = (await createPlayer(t.app, 'Celina')).id;
    const { id } = await match301();
    const response = await abandon(t.app, id, { playerId: celina });
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('not_a_participant');
  });

  it('answers an unknown match with 404', async () => {
    const response = await abandon(t.app, 'nope', { playerId: anna });
    expect(response.statusCode).toBe(404);
    expect(errorCode(response)).toBe('not_found');
  });

  it('answers 400 for a reason of 201 characters', async () => {
    const { id } = await match301();
    const response = await abandon(t.app, id, { playerId: anna, reason: 'x'.repeat(201) });
    expect(response.statusCode).toBe(400);
    expect(errorCode(response)).toBe('invalid_request');
    expect(await logEntries(t.db, id)).toHaveLength(0);
  });
});

describe('POST /matches/:id/resume', () => {
  it('continues from the paused state, mid-turn', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [T(20), T(20), T(20), S(1), S(2)]);
    const before = await getMatch(t.app, id);
    await abandonOk(id, { playerId: bartek });

    const state = await resumeOk(id);
    expect(state).toMatchObject({ status: 'in_progress', abandonment: null, eventSeq: 7 });
    expect(state.currentPlayerId).toBe(before.currentPlayerId);
    expect(state.currentDarts).toEqual(before.currentDarts);
    expect(state.turnIndex).toBe(before.turnIndex);
    expect(remaining(state)).toEqual(remaining(before));
    expect((await logEntries(t.db, id)).map((entry) => entry.type).slice(-2)).toEqual(['match_abandoned', 'match_resumed']);

    // Trzecia rzutka zamyka tę samą turę Bartka.
    const [next] = await throwDarts(t.app, id, [S(3)]);
    expect(next.events).toMatchObject([
      {
        type: 'turn_completed',
        playerId: bartek,
        darts: [
          { segment: 1, multiplier: 1 },
          { segment: 2, multiplier: 1 },
          { segment: 3, multiplier: 1 },
        ],
        total: 6,
      },
    ]);
    expect(next.state).toMatchObject({ currentPlayerId: anna, currentDarts: [] });
    expect(remaining(next.state)).toEqual([121, 295]);
  });

  it('lets undo remove a throw made before the abandon', async () => {
    const { id } = await match301();
    const [, second] = await throwDarts(t.app, id, [T(20), S(19)]);
    await abandonOk(id, { playerId: anna });
    await resumeOk(id);

    const response = await undo(t.app, id);
    expect(response.statusCode).toBe(200);
    const result = UndoResult.parse(response.json());
    expect(result.undoneThrowId).toBe(second.throw.id);
    expect(result.state).toMatchObject({ status: 'in_progress', eventSeq: 5, currentDarts: [{ segment: 20, multiplier: 3 }] });
    expect(remaining(result.state)).toEqual([241, 301]);
  });

  it('can abandon again after a resume', async () => {
    const { id } = await match301();
    await abandonOk(id, { playerId: anna, reason: 'przerwa' });
    await resumeOk(id);
    const state = await abandonOk(id, { playerId: bartek });
    expect(state.abandonment).toMatchObject({ playerId: bartek, reason: null });
  });

  it('answers 409 match_not_abandoned for a game in progress', async () => {
    const { id } = await match301();
    const response = await resume(t.app, id);
    expect(response.statusCode).toBe(409);
    expect(errorCode(response)).toBe('match_not_abandoned');
    expect(await logEntries(t.db, id)).toHaveLength(0);
  });

  it('answers an unknown match with 404', async () => {
    const response = await resume(t.app, 'nope');
    expect(response.statusCode).toBe(404);
  });

  it('keeps casual places through abandon and resume', async () => {
    const celina = (await createPlayer(t.app, 'Celina')).id;
    const { id } = await createGame(t.app, { type: 'casual', playerIds: [anna, bartek, celina], startingScore: 301 });
    await throwDarts(t.app, id, [T(20), T(20), T(20), MISS, MISS, MISS, MISS, MISS, MISS, T(20), T(17), D(5), S(20)]);
    const before = await getMatch(t.app, id);
    expect(before.placements).toEqual([{ playerId: anna, place: 1 }]);

    const abandoned = await abandonOk(id, { playerId: celina });
    expect(abandoned.placements).toEqual(before.placements);
    expect(abandoned.players.map((player) => player.place)).toEqual([1, null, null]);

    const resumed = await resumeOk(id);
    expect(resumed.placements).toEqual(before.placements);
    expect(resumed.players.map((player) => player.place)).toEqual([1, null, null]);
    expect(resumed).toMatchObject({ currentPlayerId: bartek, currentDarts: [{ segment: 20, multiplier: 1 }] });
    expect(remaining(resumed)).toEqual(remaining(before));
  });

  it('abandons and resumes a free run', async () => {
    const { id } = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna] });
    await throwDarts(t.app, id, [T(20), S(5)]);
    const abandoned = await abandonOk(id, { playerId: anna });
    expect(abandoned).toMatchObject({ status: 'abandoned', freeRun: { dartsThrown: 2, totalPoints: 65 } });

    const resumed = await resumeOk(id);
    expect(resumed).toMatchObject({ status: 'in_progress', freeRun: { dartsThrown: 2, totalPoints: 65 } });
    const [next] = await throwDarts(t.app, id, [S(1)]);
    expect(next.state.freeRun).toMatchObject({ dartsThrown: 3, totalPoints: 66 });
  });
});

describe('match summary', () => {
  it('reads the same statistics across abandon and resume', async () => {
    const { id } = await match301();
    await throwDarts(t.app, id, [T(20), T(20), T(20), S(1), S(2), S(3), T(20)]);
    const summary = async () => {
      const response = await t.app.inject({ method: 'GET', url: `/matches/${id}/summary` });
      expect(response.statusCode).toBe(200);
      return { ...response.json(), eventSeq: undefined };
    };
    const before = await summary();
    await abandonOk(id, { playerId: anna });
    expect(await summary()).toEqual(before);
    await resumeOk(id);
    expect(await summary()).toEqual(before);
  });
});

// Typy ws nie są zależnością pakietu, więc opisujemy tylko to, czego używa test.
interface TestSocket {
  on(event: 'message', listener: (data: Buffer) => void): void;
  terminate(): void;
}

describe('live updates', () => {
  it('broadcasts only state_updated on abandon and resume', async () => {
    const { id } = await match301();
    const messages: unknown[] = [];
    const socket: TestSocket = await t.app.injectWS(`/matches/${id}/live`, {}, {
      onInit(ws: TestSocket) {
        ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
      },
    });
    try {
      await vi.waitFor(() => expect(messages).toHaveLength(1));
      await abandonOk(id, { playerId: anna });
      await resumeOk(id);
      await vi.waitFor(() => expect(messages).toHaveLength(3));

      const parsed = messages.map((message) => LiveMessage.parse(message));
      expect(parsed.map((message) => message.type)).toEqual(['state_updated', 'state_updated', 'state_updated']);
      expect(parsed.map((message) => (message.type === 'state_updated' ? message.state.status : null))).toEqual(['in_progress', 'abandoned', 'in_progress']);
      expect(parsed.map((message) => message.eventSeq)).toEqual([0, 1, 2]);
    } finally {
      socket.terminate();
    }
  });
});
