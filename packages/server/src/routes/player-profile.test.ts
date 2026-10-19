import { ApiError, MatchListItem, Player, PlayerStats, StatsRankings } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEG_301, countRows, createGame, createPlayer, createPlayers, getMatch, patchPlayer, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  vi.useRealTimers();
  await t.close();
});

async function patch(playerId: string, payload: object): Promise<Player> {
  const response = await patchPlayer(t.app, playerId, payload);
  expect(response.statusCode).toBe(200);
  return Player.parse(response.json());
}

async function players(query = ''): Promise<Player[]> {
  const response = await t.app.inject({ method: 'GET', url: `/players${query}` });
  expect(response.statusCode).toBe(200);
  return Player.array().parse(response.json());
}

async function rankings(): Promise<StatsRankings> {
  const response = await t.app.inject({ method: 'GET', url: '/stats/rankings' });
  expect(response.statusCode).toBe(200);
  return StatsRankings.parse(response.json());
}

async function playLeg301(anna: string, bartek: string): Promise<string> {
  const { id } = await createGame(t.app, { type: 'match', playerIds: [anna, bartek], startingScore: 301, bestOf: 1 });
  await throwDarts(t.app, id, LEG_301);
  return id;
}

describe('PATCH /players/:id', () => {
  it('shows a new name and avatar everywhere the player appears', async () => {
    const [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
    const matchId = await playLeg301(anna, bartek);

    const updated = await patch(anna, { name: ' Ania ', avatar: '🦊' });
    expect(updated).toMatchObject({ id: anna, name: 'Ania', avatar: '🦊', guest: false, archivedAt: null });

    expect((await players()).find((player) => player.id === anna)).toEqual(updated);
    expect((await getMatch(t.app, matchId)).players[0]).toMatchObject({ id: anna, name: 'Ania', avatar: '🦊' });
    const list = MatchListItem.array().parse((await t.app.inject({ method: 'GET', url: '/matches' })).json());
    expect(list[0]?.players[0]).toMatchObject({ id: anna, name: 'Ania', avatar: '🦊' });
    expect((await rankings()).players.find((player) => player.playerId === anna)).toMatchObject({ name: 'Ania', avatar: '🦊' });
  });

  it('keeps createdAt and clears the avatar with null', async () => {
    const anna = await createPlayer(t.app, 'Anna');
    await patch(anna.id, { avatar: '🎯' });
    expect(await patch(anna.id, { avatar: null })).toEqual({ ...anna, avatar: null });
  });

  it('appends one player_changes row per change and leaves the players row as created', async () => {
    const anna = await createPlayer(t.app, 'Anna');
    const before = await t.db.selectFrom('players').selectAll().where('id', '=', anna.id).executeTakeFirstOrThrow();
    await patch(anna.id, { name: 'Ania' });
    await patch(anna.id, { avatar: '🦊' });

    expect(await countRows(t.db, 'player_changes')).toBe(2);
    const changes = await t.db.selectFrom('player_changes').select(['seq', 'name', 'avatar']).where('player_id', '=', anna.id).orderBy('seq').execute();
    expect(changes).toEqual([
      { seq: 1, name: 'Ania', avatar: null },
      { seq: 2, name: 'Ania', avatar: '🦊' },
    ]);
    expect(await t.db.selectFrom('players').selectAll().where('id', '=', anna.id).executeTakeFirstOrThrow()).toEqual(before);
  });

  it('archives a player out of the player list but not out of the rankings, and restores them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T10:00:00.000Z'));
    const [anna, bartek] = (await createPlayers(t.app, 2)) as [string, string];
    await playLeg301(anna, bartek);

    vi.setSystemTime(new Date('2026-10-18T11:00:00.000Z'));
    expect(await patch(bartek, { archived: true })).toMatchObject({ archivedAt: '2026-10-18T11:00:00.000Z' });
    vi.setSystemTime(new Date('2026-10-18T12:00:00.000Z'));
    expect(await patch(bartek, { archived: true })).toMatchObject({ archivedAt: '2026-10-18T11:00:00.000Z' });

    expect((await players()).map((player) => player.id)).toEqual([anna]);
    expect((await players('?archived=include')).map((player) => [player.id, player.archivedAt])).toEqual([
      [anna, null],
      [bartek, '2026-10-18T11:00:00.000Z'],
    ]);
    expect((await rankings()).players.map((player) => player.playerId)).toContain(bartek);

    expect(await patch(bartek, { archived: false })).toMatchObject({ archivedAt: null });
    expect((await players()).map((player) => player.id)).toEqual([anna, bartek]);
  });

  it('saves a guest, whose earlier throws then count', async () => {
    const anna = await createPlayer(t.app, 'Anna');
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    await playLeg301(guest.id, anna.id);
    expect((await players()).map((player) => player.id)).toEqual([anna.id]);
    expect((await players('?archived=include')).map((player) => player.id)).toEqual([anna.id]);

    expect(await patch(guest.id, { guest: false })).toMatchObject({ guest: false, name: 'Gość' });
    // Ta sama ostatnia aktywność, więc kolejność po imieniu.
    expect((await players()).map((player) => player.id)).toEqual([anna.id, guest.id]);
    const stats = PlayerStats.parse((await t.app.inject({ method: 'GET', url: `/players/${guest.id}/stats` })).json());
    expect(stats).toMatchObject({ dartsThrown: 6, points: 301, average: 150.5, legsWon: 1, matchesPlayed: 1, matchesWon: 1 });
  });

  it('answers 404 for an unknown player', async () => {
    const response = await patchPlayer(t.app, 'nobody', { name: 'Ania' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });

  it.each([
    ['an empty body', {}],
    ['guest true', { guest: true }],
    ['a blank name', { name: '  ' }],
  ])('answers 400 for %s', async (_name, payload) => {
    const anna = await createPlayer(t.app, 'Anna');
    const response = await patchPlayer(t.app, anna.id, payload);
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
    expect(await countRows(t.db, 'player_changes')).toBe(0);
  });
});

describe('GET /players', () => {
  it('answers 400 for an unknown archived value', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/players?archived=bogus' });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });
});
