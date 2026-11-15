import { MIN_LEGS_FOR_AVERAGE, type Player } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import type { PlayerLeg } from './completed-legs.js';
import { buildOverall } from './overall.js';
import type { RankedGame } from './rankings.js';
import { EMPTY_TOTALS } from './tally.js';

const createdAt = '2026-10-15T18:30:00.000Z';

function profile(id: string, name: string, color: number): Player {
  return { id, name, avatar: null, color, guest: false, archivedAt: null, createdAt };
}

const anna = profile('anna', 'Anna', 1);
const bartek = profile('bartek', 'Bartek', 7);
const celina = profile('celina', 'Celina', 12);

function leg(playerId: string, legIndex: number, points: number, darts: number): PlayerLeg {
  return { playerId, legIndex, points, darts };
}

// darts to wszystkie rzutki gracza z zamkniętych tur gry, także spoza ukończonych legów.
function game(legs: PlayerLeg[], darts: Record<string, number>): RankedGame {
  return {
    type: 'match',
    legs,
    tally: {
      players: new Map(Object.entries(darts).map(([id, count]) => [id, { ...EMPTY_TOTALS, darts: count }])),
      legs: [],
      winnerId: null,
    },
  };
}

describe('buildOverall', () => {
  it('gives zeros and an empty list without games', () => {
    expect(buildOverall({ players: [anna, bartek], games: [] })).toEqual({ games: 0, legs: 0, darts: 0, average: null, players: [] });
  });

  it('weighs every player the same in the average of averages', () => {
    // Anna: 301 punktów w 6 rzutkach (150,5), Bartek: 0 w 3. Średnia ze wszystkich rzutek dałaby 100,33.
    const overall = buildOverall({
      players: [anna, bartek],
      games: [game([leg('anna', 0, 301, 6), leg('bartek', 0, 0, 3)], { anna: 6, bartek: 3 })],
    });
    expect(overall).toEqual({
      games: 1,
      legs: 1,
      darts: 9,
      average: 75.25,
      players: [
        { playerId: 'anna', name: 'Anna', avatar: null, color: 1, darts: 6, legs: 1, average: 150.5, difference: 75.25 },
        { playerId: 'bartek', name: 'Bartek', avatar: null, color: 7, darts: 3, legs: 1, average: 0, difference: -75.25 },
      ],
    });
  });

  it('gives a player below the ranking minimum an average and a difference', () => {
    const overall = buildOverall({
      players: [anna, bartek],
      games: [game([leg('anna', 0, 60, 3), leg('anna', 1, 60, 3), leg('anna', 2, 60, 3), leg('bartek', 0, 30, 3)], { anna: 9, bartek: 3 })],
    });
    expect(MIN_LEGS_FOR_AVERAGE).toBeGreaterThan(1);
    expect(overall.average).toBe(45);
    expect(overall.players.map((entry) => [entry.name, entry.legs, entry.average, entry.difference])).toEqual([
      ['Anna', 3, 60, 15],
      ['Bartek', 1, 30, -15],
    ]);
  });

  it('lists a player without a completed leg last and counts their darts', () => {
    const overall = buildOverall({
      players: [celina, anna, bartek],
      games: [
        game([leg('anna', 0, 150, 6), leg('bartek', 0, 30, 3)], { anna: 6, bartek: 3 }),
        game([], { celina: 12, bartek: 15 }),
      ],
    });
    expect(overall).toMatchObject({ games: 1, legs: 1, darts: 36, average: 52.5 });
    expect(overall.players.map((entry) => [entry.name, entry.darts, entry.average, entry.difference])).toEqual([
      ['Anna', 6, 75, 22.5],
      ['Bartek', 18, 30, -22.5],
      ['Celina', 12, null, null],
    ]);
  });

  it('sorts players without an average by darts, then by name', () => {
    const overall = buildOverall({
      players: [anna, bartek, celina],
      games: [game([], { celina: 6, bartek: 3, anna: 3 })],
    });
    expect(overall.average).toBeNull();
    expect(overall.players.map((entry) => entry.name)).toEqual(['Celina', 'Anna', 'Bartek']);
  });

  it('counts nothing from a guest', () => {
    const overall = buildOverall({
      players: [anna],
      games: [game([leg('guest', 0, 301, 6), leg('anna', 0, 0, 3)], { guest: 6, anna: 3 })],
    });
    expect(overall).toEqual({
      games: 1,
      legs: 1,
      darts: 3,
      average: 0,
      players: [{ playerId: 'anna', name: 'Anna', avatar: null, color: 1, darts: 3, legs: 1, average: 0, difference: 0 }],
    });
    expect(Object.is(overall.players[0]?.difference, 0)).toBe(true);
  });

  it('skips a saved player without darts', () => {
    const overall = buildOverall({ players: [anna, bartek], games: [game([leg('anna', 0, 60, 3)], { anna: 3, bartek: 0 })] });
    expect(overall.players.map((entry) => entry.name)).toEqual(['Anna']);
  });

  it('breaks a tie on the difference by name', () => {
    const overall = buildOverall({
      players: [celina, bartek, anna],
      games: [game([leg('celina', 0, 60, 3), leg('bartek', 0, 60, 3), leg('anna', 0, 60, 3)], { celina: 3, bartek: 3, anna: 3 })],
    });
    expect(overall.players.map((entry) => [entry.name, entry.difference])).toEqual([
      ['Anna', 0],
      ['Bartek', 0],
      ['Celina', 0],
    ]);
  });

  it('rounds the difference from the two rounded averages', () => {
    // Średnie 100, 50 i 33,33 dają średnią ogólną 61,11.
    const overall = buildOverall({
      players: [anna, bartek, celina],
      games: [game([leg('anna', 0, 100, 3), leg('bartek', 0, 50, 3), leg('celina', 0, 100, 9)], { anna: 3, bartek: 3, celina: 9 })],
    });
    expect(overall.average).toBe(61.11);
    expect(overall.players.map((entry) => [entry.name, entry.average, entry.difference])).toEqual([
      ['Anna', 100, 38.89],
      ['Bartek', 50, -11.11],
      ['Celina', 33.33, -27.78],
    ]);
  });
});
