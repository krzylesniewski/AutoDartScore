import { ApiError, Player } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPlayerColor } from '../store/player-color.js';
import { T, countRows, createGame, createPlayer, patchPlayer, setup, throwDarts, type TestApp } from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  vi.useRealTimers();
  await t.close();
});

describe('players', () => {
  it('creates players and lists the non-guests, by name when nobody played', async () => {
    const response = await t.app.inject({ method: 'POST', url: '/players', payload: { name: ' Zosia ', avatar: '🎯' } });
    expect(response.statusCode).toBe(201);
    const zosia = Player.parse(response.json());
    expect(zosia).toMatchObject({ name: 'Zosia', avatar: '🎯', guest: false });

    const anna = await createPlayer(t.app, 'Anna');
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    expect(guest.guest).toBe(true);

    const list = await t.app.inject({ method: 'GET', url: '/players' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([anna, zosia]);
  });

  it('lists the most recently active players first and those who never played last', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const at = (minute: number) => vi.setSystemTime(new Date(Date.UTC(2026, 9, 18, 18, minute)));
    at(0);
    const [anna, bartek, celina, darek] = [await createPlayer(t.app, 'Anna'), await createPlayer(t.app, 'Bartek'), await createPlayer(t.app, 'Celina'), await createPlayer(t.app, 'Darek')];
    at(1);
    const annaGame = await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [anna.id] });
    at(2);
    await createGame(t.app, { type: 'practice', practiceMode: 'free_run', playerIds: [celina.id] });
    at(3);
    await throwDarts(t.app, annaGame.id, [T(20)]);

    const list = await t.app.inject({ method: 'GET', url: '/players' });
    expect(list.json()).toEqual([anna, celina, bartek, darek]);
  });

  it('stores a chosen color', async () => {
    const anna = await createPlayer(t.app, 'Anna', { color: 7 });
    expect(anna.color).toBe(7);
    const list = await t.app.inject({ method: 'GET', url: '/players' });
    expect(Player.array().parse(list.json())).toEqual([anna]);
  });

  it('gives a player without a chosen color the default color on every read', async () => {
    const anna = await createPlayer(t.app, 'Anna');
    const guest = await createPlayer(t.app, 'Gość', { guest: true });
    expect(anna.color).toBe(defaultPlayerColor(anna.id));
    expect(guest.color).toBe(defaultPlayerColor(guest.id));
    for (let read = 0; read < 2; read++) {
      const list = await t.app.inject({ method: 'GET', url: '/players' });
      expect(Player.array().parse(list.json()).map((player) => player.color)).toEqual([defaultPlayerColor(anna.id)]);
    }
    const game = await createGame(t.app, { type: 'casual', playerIds: [anna.id, guest.id], startingScore: 301 });
    expect(game.players.map((player) => player.color)).toEqual([defaultPlayerColor(anna.id), defaultPlayerColor(guest.id)]);
  });

  it.each([0, 17, 1.5])('rejects color %d', async (color) => {
    const response = await t.app.inject({ method: 'POST', url: '/players', payload: { name: 'Anna', color } });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });

  it('rejects an empty name', async () => {
    const response = await t.app.inject({ method: 'POST', url: '/players', payload: { name: '' } });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json()).error).toBe('invalid_request');
  });

  it('answers malformed JSON with 400 and the ApiError shape', async () => {
    const response = await t.app.inject({
      method: 'POST',
      url: '/players',
      headers: { 'content-type': 'application/json' },
      payload: '{"name": ',
    });
    expect(response.statusCode).toBe(400);
    expect(ApiError.parse(response.json())).toEqual({ error: 'invalid_request', message: expect.any(String) });
  });

  it('answers an unknown route with 404 and the ApiError shape', async () => {
    const response = await t.app.inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
    expect(ApiError.parse(response.json()).error).toBe('not_found');
  });
});

describe('duplicate player names', () => {
  async function expectTaken(payload: object) {
    const before = [await countRows(t.db, 'players'), await countRows(t.db, 'player_changes')];
    const response = await t.app.inject({ method: 'POST', url: '/players', payload });
    expect(response.statusCode).toBe(409);
    expect(ApiError.parse(response.json()).error).toBe('player_name_taken');
    expect([await countRows(t.db, 'players'), await countRows(t.db, 'player_changes')]).toEqual(before);
  }

  it.each(['anna', '  ANNA  '])('rejects %j after Anna', async (name) => {
    await createPlayer(t.app, 'Anna');
    await expectTaken({ name });
  });

  it('ignores extra inner spaces', async () => {
    await createPlayer(t.app, 'Anna Maria');
    await expectTaken({ name: 'anna   maria' });
  });

  it('lets a guest take the name of a saved player', async () => {
    await createPlayer(t.app, 'Anna');
    await createPlayer(t.app, 'Anna', { guest: true });
  });

  it('does not count a guest', async () => {
    await createPlayer(t.app, 'Anna', { guest: true });
    await createPlayer(t.app, 'Anna');
  });

  it('does not count an archived player', async () => {
    const anna = await createPlayer(t.app, 'Anna');
    expect((await patchPlayer(t.app, anna.id, { archived: true })).statusCode).toBe(200);
    await createPlayer(t.app, 'Anna');
  });
});
