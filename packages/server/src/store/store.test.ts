import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateToLatest, openDatabase, type Database } from '../db/index.js';
import { MISS, S, countRows, hitEvent, logEntries } from '../test-helpers.js';
import { createStore, type Store } from './store.js';

let db: Kysely<Database>;
let store: Store;
let matchId: string;

beforeEach(async () => {
  db = openDatabase(':memory:');
  await migrateToLatest(db);
  store = createStore(db);
  const playerId = (await store.createPlayer({ name: 'Anna', guest: false })).id;
  matchId = await store.createMatch({
    type: 'practice',
    practiceMode: 'free_run',
    startingScore: null,
    legsToWin: null,
    firstPlayerIndex: null,
    countsToStats: false,
    checkoutRange: null,
    checkoutSeed: null,
    checkoutRule: null,
    playerIds: [playerId],
  });
});
afterEach(async () => {
  await db.destroy();
});

describe('appendThrows', () => {
  it('writes the throws with consecutive seqs in order', async () => {
    await store.appendThrow(hitEvent(matchId, S(20)));
    const hits = [hitEvent(matchId, MISS, { sequence: 0 }), hitEvent(matchId, MISS, { sequence: 1 })];

    const { throws, seqs } = await store.appendThrows(hits);
    expect(seqs).toEqual([2, 3]);
    expect(throws.map((record) => record.eventId)).toEqual(hits.map((hit) => hit.eventId));
    expect((await logEntries(db, matchId)).map((entry) => [entry.seq, entry.type, entry.throw_id])).toEqual([
      [1, 'throw', expect.any(String)],
      [2, 'throw', throws[0]?.id],
      [3, 'throw', throws[1]?.id],
    ]);
  });

  it('leaves no row and no log entry from the batch when the second insert fails', async () => {
    const existing = hitEvent(matchId, S(20));
    await store.appendThrow(existing);

    await expect(store.appendThrows([hitEvent(matchId, MISS), hitEvent(matchId, MISS, { eventId: existing.eventId })])).rejects.toThrow();
    expect(await countRows(db, 'throws')).toBe(1);
    expect(await logEntries(db, matchId)).toHaveLength(1);
  });
});
