import { describe, expect, it } from 'vitest';
import { CreatePlayerRequest, ListPlayersQuery, Player, UpdatePlayerRequest } from './index.js';

describe('CreatePlayerRequest', () => {
  it('defaults guest to false and trims the name', () => {
    expect(CreatePlayerRequest.parse({ name: '  Anna ' })).toEqual({ name: 'Anna', guest: false });
  });

  it('accepts an emoji avatar and a guest', () => {
    expect(CreatePlayerRequest.parse({ name: 'Bartek', avatar: '🎯', guest: true })).toEqual({ name: 'Bartek', avatar: '🎯', guest: true });
  });

  it('accepts a color from 1 to 16 and no color', () => {
    expect(CreatePlayerRequest.parse({ name: 'Anna', color: 1 })).toEqual({ name: 'Anna', color: 1, guest: false });
    expect(CreatePlayerRequest.parse({ name: 'Anna', color: 16 })).toEqual({ name: 'Anna', color: 16, guest: false });
    expect(CreatePlayerRequest.parse({ name: 'Anna' })).not.toHaveProperty('color');
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a blank name', { name: '   ' }],
    ['a name over 40 characters', { name: 'a'.repeat(41) }],
    ['an empty avatar', { name: 'Anna', avatar: '' }],
    ['an avatar over 16 characters', { name: 'Anna', avatar: 'x'.repeat(17) }],
    ['color 0', { name: 'Anna', color: 0 }],
    ['color 17', { name: 'Anna', color: 17 }],
    ['a fractional color', { name: 'Anna', color: 1.5 }],
    ['color null', { name: 'Anna', color: null }],
    ['a missing name', {}],
  ])('rejects %s', (_name, value) => {
    expect(CreatePlayerRequest.safeParse(value).success).toBe(false);
  });
});

describe('Player', () => {
  it('accepts a player without an avatar', () => {
    const player = { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, archivedAt: null, createdAt: '2026-10-15T18:30:12.345Z' };
    expect(Player.parse(player)).toEqual(player);
  });

  it('accepts an archived player', () => {
    const player = { id: 'p1', name: 'Anna', avatar: '🎯', color: 16, guest: false, archivedAt: '2026-10-16T10:00:00.000Z', createdAt: '2026-10-15T18:30:12.345Z' };
    expect(Player.parse(player)).toEqual(player);
  });

  it('rejects a non-ISO createdAt', () => {
    expect(Player.safeParse({ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, archivedAt: null, createdAt: '15.10.2026' }).success).toBe(false);
  });

  it.each([
    ['a missing color', undefined],
    ['color 0', 0],
    ['color 17', 17],
    ['a fractional color', 1.5],
  ])('rejects %s', (_name, color) => {
    const player = { id: 'p1', name: 'Anna', avatar: null, color, guest: false, archivedAt: null, createdAt: '2026-10-15T18:30:12.345Z' };
    expect(Player.safeParse(player).success).toBe(false);
  });

  it('requires archivedAt', () => {
    expect(Player.safeParse({ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, createdAt: '2026-10-15T18:30:12.345Z' }).success).toBe(false);
  });
});

describe('UpdatePlayerRequest', () => {
  it('trims the name and keeps only the given keys', () => {
    expect(UpdatePlayerRequest.parse({ name: '  Ania ' })).toEqual({ name: 'Ania' });
  });

  it('accepts avatar null to clear the avatar', () => {
    expect(UpdatePlayerRequest.parse({ avatar: null })).toEqual({ avatar: null });
  });

  it('accepts a color alone', () => {
    expect(UpdatePlayerRequest.parse({ color: 3 })).toEqual({ color: 3 });
    expect(UpdatePlayerRequest.parse({ name: 'Ania' })).not.toHaveProperty('color');
  });

  it('accepts archiving, restoring and saving a guest', () => {
    expect(UpdatePlayerRequest.parse({ archived: true })).toEqual({ archived: true });
    expect(UpdatePlayerRequest.parse({ archived: false })).toEqual({ archived: false });
    expect(UpdatePlayerRequest.parse({ guest: false })).toEqual({ guest: false });
  });

  it.each([
    ['an empty object', {}],
    ['guest true', { guest: true }],
    ['a blank name', { name: '   ' }],
    ['a name over 40 characters', { name: 'a'.repeat(41) }],
    ['an empty avatar', { avatar: '' }],
    ['an avatar over 16 characters', { avatar: 'x'.repeat(17) }],
    ['color 0', { color: 0 }],
    ['color 17', { color: 17 }],
    ['a fractional color', { color: 1.5 }],
    ['color null', { color: null }],
  ])('rejects %s', (_name, value) => {
    expect(UpdatePlayerRequest.safeParse(value).success).toBe(false);
  });
});

describe('ListPlayersQuery', () => {
  it('accepts no query and archived=include', () => {
    expect(ListPlayersQuery.parse({})).toEqual({});
    expect(ListPlayersQuery.parse({ archived: 'include' })).toEqual({ archived: 'include' });
  });

  it('rejects another archived value', () => {
    expect(ListPlayersQuery.safeParse({ archived: 'bogus' }).success).toBe(false);
  });
});
