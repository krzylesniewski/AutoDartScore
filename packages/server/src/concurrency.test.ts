import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { T, countRows, createGame, createPlayers, hitEvent, logEntries, postThrow, setup, type TestApp } from './test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe('concurrent commands for one match', () => {
  it('serialises three throws into seqs 1 to 3 and a completed turn', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const responses = await Promise.all([T(20), T(19), T(18)].map((dart) => postThrow(t.app, id, hitEvent(id, dart))));
    expect(responses.map((response) => response.statusCode)).toEqual([201, 201, 201]);
    expect(responses.map((response) => response.json().state.eventSeq).sort()).toEqual([1, 2, 3]);
    expect((await logEntries(t.db, id)).map((entry) => entry.seq)).toEqual([1, 2, 3]);

    const events = responses.flatMap((response) => response.json().events);
    expect(events).toEqual([expect.objectContaining({ type: 'turn_completed', playerId: anna, total: 171, remaining: 130 })]);
  });

  it('stores one throw when the same HitEvent arrives twice at once', async () => {
    const [anna, bartek] = await createPlayers(t.app, 2);
    const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301 });
    const hit = hitEvent(id, T(20));
    const responses = await Promise.all([postThrow(t.app, id, hit), postThrow(t.app, id, hit)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 201]);
    expect(await countRows(t.db, 'throws')).toBe(1);
    expect(await logEntries(t.db, id)).toHaveLength(1);
  });
});
