import { ApiError, Player } from '@autoscore/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPlayer, setup, type TestApp } from '../test-helpers.js';

let t: TestApp;
beforeEach(async () => {
  t = await setup();
});
afterEach(async () => {
  await t.close();
});

describe('players', () => {
  it('creates players and lists the non-guests by name', async () => {
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
