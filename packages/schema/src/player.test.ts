import { describe, expect, it } from 'vitest';
import { CreatePlayerRequest, Player } from './index.js';

describe('CreatePlayerRequest', () => {
  it('defaults guest to false and trims the name', () => {
    expect(CreatePlayerRequest.parse({ name: '  Anna ' })).toEqual({ name: 'Anna', guest: false });
  });

  it('accepts an emoji avatar and a guest', () => {
    expect(CreatePlayerRequest.parse({ name: 'Bartek', avatar: '🎯', guest: true })).toEqual({ name: 'Bartek', avatar: '🎯', guest: true });
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a blank name', { name: '   ' }],
    ['a name over 40 characters', { name: 'a'.repeat(41) }],
    ['an empty avatar', { name: 'Anna', avatar: '' }],
    ['an avatar over 16 characters', { name: 'Anna', avatar: 'x'.repeat(17) }],
    ['a missing name', {}],
  ])('rejects %s', (_name, value) => {
    expect(CreatePlayerRequest.safeParse(value).success).toBe(false);
  });
});

describe('Player', () => {
  it('accepts a player without an avatar', () => {
    const player = { id: 'p1', name: 'Anna', avatar: null, guest: false, createdAt: '2026-10-15T18:30:12.345Z' };
    expect(Player.parse(player)).toEqual(player);
  });

  it('rejects a non-ISO createdAt', () => {
    expect(Player.safeParse({ id: 'p1', name: 'Anna', avatar: null, guest: false, createdAt: '15.10.2026' }).success).toBe(false);
  });
});
