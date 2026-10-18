import { ApiError, Player } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T, createGame, createPlayer, setup, throwDarts, type TestApp } from '../test-helpers.js';

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
