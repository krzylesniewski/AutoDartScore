import { TournamentConfig, TournamentEvent } from '@autoscore/schema';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateToLatest, openDatabase, type Database } from '../db/index.js';
import { MISS, S, countRows, hitEvent, logEntries } from '../test-helpers.js';
import { createStore, type NewMatch, type Store } from './store.js';

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

describe('tournaments', () => {
  async function tournament(): Promise<string> {
    const ids = [];
    for (const name of ['Bartek', 'Celina', 'Darek']) {
      ids.push((await store.createPlayer({ name, guest: false })).id);
    }
    const config = TournamentConfig.parse({ name: 'Liga testowa', format: 'league', playerIds: ids, startingScore: 301 });
    return store.createTournament(config, [...ids].reverse());
  }

  const fixtureMatch = (playerIds: readonly string[]): NewMatch => ({
    type: 'match',
    practiceMode: null,
    startingScore: 301,
    legsToWin: 1,
    firstPlayerIndex: 0,
    countsToStats: true,
    checkoutRange: null,
    checkoutSeed: null,
    checkoutRule: null,
    playerIds,
  });

  it('stores the config, the players in entry order and the first draw', async () => {
    const id = await tournament();
    expect(id).toMatch(/^t_[A-Za-z0-9_-]{22}$/);
    const stored = await store.findTournament(id);
    const playerIds = stored?.players.map((player) => player.id) ?? [];
    expect(stored?.config).toMatchObject({ name: 'Liga testowa', format: 'league', playerIds, startingScore: 301, sharing: true });
    expect(stored?.players.map((player) => player.name)).toEqual(['Bartek', 'Celina', 'Darek']);
    const [draw, ...rest] = await store.loadTournamentLog(id);
    expect(draw).toMatchObject({ type: 'draw', order: [...playerIds].reverse(), seq: 1 });
    expect(rest).toEqual([]);
    expect(await store.findTournament('t_nope')).toBeNull();
  });

  it('links the fixture match to the tournament and logs the start in one step', async () => {
    const id = await tournament();
    const players = (await store.findTournament(id))?.players.map((player) => player.id) ?? [];
    const started = await store.startFixture(id, 'g-1', fixtureMatch(players.slice(0, 2)));
    expect(started.seq).toBe(2);
    const link = { id, name: 'Liga testowa', format: 'league', fixtureId: 'g-1' };
    expect((await store.findMatch(started.matchId))?.tournament).toEqual(link);
    expect((await store.findMatch(matchId))?.tournament).toBeNull();
    expect((await store.listMatches({ tournamentId: id })).map((match) => [match.id, match.tournament])).toEqual([[started.matchId, link]]);
    expect((await store.loadTournamentLog(id)).at(-1)).toMatchObject({
      type: 'fixture_started',
      fixtureId: 'g-1',
      matchId: started.matchId,
      seq: 2,
    });
  });

  it('leaves no match and no log entry when the start fails', async () => {
    const id = await tournament();
    await expect(store.startFixture(id, 'g-1', fixtureMatch(['nope', 'nada']))).rejects.toThrow();
    expect(await countRows(db, 'matches')).toBe(1);
    expect(await store.loadTournamentLog(id)).toHaveLength(1);
  });

  it('round-trips every event type and rejects a corrupt row', async () => {
    const id = await tournament();
    const playerId = (await store.findTournament(id))?.players[0]?.id ?? '';
    await store.appendTournamentEvent(id, { type: 'player_withdrawn', playerId });
    await store.appendTournamentEvent(id, { type: 'result_corrected', fixtureId: 'g-1', legs: [0, 1] });
    await store.appendTournamentEvent(id, { type: 'sharing_changed', sharing: false });
    expect(await store.appendTournamentEvent(id, { type: 'archived' })).toBe(5);
    expect((await store.loadTournamentLog(id)).slice(1).map((entry) => TournamentEvent.parse(entry))).toEqual([
      { type: 'player_withdrawn', playerId },
      { type: 'result_corrected', fixtureId: 'g-1', legs: [0, 1] },
      { type: 'sharing_changed', sharing: false },
      { type: 'archived' },
    ]);

    await db
      .insertInto('tournament_events')
      .values({ tournament_id: id, seq: 6, type: 'draw', draw_order: 'nie json', created_at: new Date().toISOString() })
      .execute();
    await expect(store.loadTournamentLog(id)).rejects.toThrow('Corrupt tournament log: draw at seq 6');
  });
});
