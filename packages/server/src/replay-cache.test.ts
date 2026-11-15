import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateToLatest, openDatabase, type Database } from './db/index.js';
import { createReplayCache, type ReplayCache } from './replay-cache.js';
import { createStore, type Store, type StoredMatch } from './store/store.js';
import { S, hitEvent } from './test-helpers.js';

let db: Kysely<Database>;
let store: Store;
let playerId: string;
// Każde wywołanie loadLogs z listą wczytanych gier.
let loaded: string[][];
let lastSeqCalls: number;
// Wykonywane w loadLogs przed odczytem, czyli między lastSeqs a loadLogs.
let beforeLoad: () => Promise<void>;
const warn = vi.fn();

beforeEach(async () => {
  db = openDatabase(':memory:');
  await migrateToLatest(db);
  store = createStore(db);
  playerId = (await store.createPlayer({ name: 'Anna', guest: false })).id;
  loaded = [];
  lastSeqCalls = 0;
  beforeLoad = async () => {};
  warn.mockReset();
});
afterEach(async () => {
  await db.destroy();
});

function cache(maxEntries: number): ReplayCache {
  const counted: Pick<Store, 'lastSeqs' | 'loadLogs'> = {
    lastSeqs(ids) {
      lastSeqCalls += 1;
      return store.lastSeqs(ids);
    },
    async loadLogs(ids) {
      loaded.push([...ids]);
      await beforeLoad();
      return store.loadLogs(ids);
    },
  };
  return createReplayCache({ store: counted, log: { warn }, maxEntries });
}

async function freeRun(darts = 1): Promise<StoredMatch> {
  const id = await store.createMatch({
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
  for (let dart = 0; dart < darts; dart++) {
    await store.appendThrow(hitEvent(id, S(20)));
  }
  const match = await store.findMatch(id);
  if (!match) {
    throw new Error('match not stored');
  }
  return match;
}

function ids(replays: readonly { match: StoredMatch }[]): string[] {
  return replays.map(({ match }) => match.id);
}

describe('createReplayCache', () => {
  it('replays the matches in input order and loads no log for an unchanged second call', async () => {
    const [a, b, c] = [await freeRun(1), await freeRun(2), await freeRun(0)];
    const replays = cache(10);

    const first = await replays.many([c, a, b]);
    expect(ids(first)).toEqual([c.id, a.id, b.id]);
    expect(first.map(({ replay }) => replay.seq)).toEqual([0, 1, 2]);
    expect(loaded).toEqual([[c.id, a.id, b.id]]);

    const second = await replays.many([a, b, c]);
    expect(ids(second)).toEqual([a.id, b.id, c.id]);
    expect(loaded).toHaveLength(1);
    expect(lastSeqCalls).toBe(2);
    expect(second[0]?.replay).toBe(first[1]?.replay);
  });

  it('loads only the match that got a new throw', async () => {
    const [a, b] = [await freeRun(), await freeRun()];
    const replays = cache(10);
    await replays.many([a, b]);

    await store.appendThrow(hitEvent(b.id, S(19)));
    const after = await replays.many([a, b]);
    expect(loaded).toEqual([[a.id, b.id], [b.id]]);
    expect(after.map(({ replay }) => replay.throws.length)).toEqual([1, 2]);

    await replays.many([a, b]);
    expect(loaded).toHaveLength(2);
  });

  it('evicts the least recently used match past maxEntries', async () => {
    const [a, b, c] = [await freeRun(), await freeRun(), await freeRun()];
    const replays = cache(2);
    await replays.many([a, b]);
    await replays.many([a]); // a jest teraz używane najpóźniej
    await replays.many([c]); // wypycha b
    expect(loaded).toEqual([[a.id, b.id], [c.id]]);

    await replays.many([a, c]);
    expect(loaded).toHaveLength(2);
    await replays.many([b]);
    expect(loaded).toEqual([[a.id, b.id], [c.id], [b.id]]);
  });

  it('loads and replays on every call with maxEntries 0', async () => {
    const a = await freeRun();
    const replays = cache(0);
    await replays.many([a]);
    await replays.many([a]);
    await replays.one(a);
    expect(loaded).toEqual([[a.id], [a.id], [a.id]]);
  });

  it('stores the entry under the seq of the log it actually loaded', async () => {
    const a = await freeRun(1);
    const replays = cache(10);
    beforeLoad = async () => {
      beforeLoad = async () => {};
      await store.appendThrow(hitEvent(a.id, S(18)));
    };

    const [first] = await replays.many([a]);
    expect(first?.replay.seq).toBe(2);
    expect(first?.replay.throws).toHaveLength(2);

    const second = await replays.one(a);
    expect(loaded).toHaveLength(1);
    expect(second).toBe(first?.replay);
  });

  it('skips and logs a corrupt match, never caches it and lets one reject', async () => {
    const [a, broken, unreplayable] = [await freeRun(), await freeRun(), await freeRun()];
    // Wpis throw bez throw_id psuje odczyt logu, a undo nie ostatniej rzutki psuje odtworzenie.
    await db.insertInto('match_events').values({ match_id: broken.id, seq: 2, type: 'throw', throw_id: null, created_at: '2026-11-15T18:00:00.000Z' }).execute();
    const [earlier] = (await store.loadLog(unreplayable.id)).throws.keys();
    await store.appendThrow(hitEvent(unreplayable.id, S(1)));
    await store.appendUndo(unreplayable.id, earlier ?? '');
    const replays = cache(10);

    const first = await replays.many([broken, a, unreplayable]);
    expect(ids(first)).toEqual([a.id]);
    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledWith({ matchId: broken.id, err: expect.any(Error) }, expect.any(String));
    expect(warn).toHaveBeenCalledWith({ matchId: unreplayable.id, err: expect.any(Error) }, expect.any(String));
    expect(warn).toHaveBeenLastCalledWith({ skipped: 2 }, expect.any(String));

    await replays.many([broken, a, unreplayable]);
    expect(loaded).toEqual([
      [broken.id, a.id, unreplayable.id],
      [broken.id, unreplayable.id],
    ]);

    await expect(replays.one(broken)).rejects.toThrow('Corrupt log');
    await expect(replays.one(unreplayable)).rejects.toThrow('Corrupt log');
    expect(loaded).toHaveLength(4);
  });
});
