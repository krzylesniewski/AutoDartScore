import { describe, expect, it } from 'vitest';
import { listItem, player } from '../test/snapshots';
import { historyRow } from './history-row';

const now = new Date(2026, 9, 18, 21, 0);

describe('historyRow', () => {
  it('describes a finished 1v1 with the legs and the winner', () => {
    const game = listItem({
      startingScore: 301,
      status: 'finished',
      currentPlayerId: null,
      winnerId: 'p2',
      players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 2 })],
      updatedAt: new Date(2026, 9, 18, 20, 15).toISOString(),
    });
    expect(historyRow(game, now)).toEqual({ type: 'Mecz 1v1 · 301', result: 'Anna 1 : 2 Bartek', status: 'finished', statusLabel: 'Wygrywa Bartek', date: 'dziś 20:15' });
  });

  it('lists the casual players by place, then those still playing', () => {
    const game = listItem({
      type: 'casual',
      legsToWin: null,
      status: 'abandoned',
      players: [player('p1', 'Anna'), player('p2', 'Bartek'), player('p3', 'Celina'), player('p4', 'Darek')],
      placements: [
        { playerId: 'p3', place: 1 },
        { playerId: 'p1', place: 2 },
      ],
    });
    expect(historyRow(game, now)).toMatchObject({ type: 'Zabawa · 501', result: '1. Celina · 2. Anna · Bartek · Darek', status: 'abandoned', statusLabel: 'Porzucony' });
  });

  it('names the casual winner when the game is finished', () => {
    const game = listItem({
      type: 'casual',
      status: 'finished',
      players: [player('p1', 'Anna'), player('p2', 'Bartek')],
      placements: [
        { playerId: 'p2', place: 1 },
        { playerId: 'p1', place: 2 },
      ],
    });
    expect(historyRow(game, now)).toMatchObject({ result: '1. Bartek · 2. Anna', statusLabel: 'Wygrywa Bartek' });
  });

  it('names the Solo 501 player and says finished without a winner', () => {
    const game = listItem({ type: 'practice', practiceMode: 'solo_501', startingScore: 501, legsToWin: null, status: 'finished', winnerId: 'p1', players: [player('p1', 'Anna')] });
    expect(historyRow(game, now)).toMatchObject({ type: 'Trening · Solo 501', result: 'Anna', status: 'finished', statusLabel: 'Ukończony' });
  });

  it('gives the darts and the average of an ended Free run', () => {
    const game = listItem({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      status: 'ended',
      players: [player('p1', 'Anna', { remaining: null })],
      freeRun: { dartsThrown: 12, totalPoints: 180, average: 45 },
      endedAt: '2026-10-17T19:00:00.000Z',
      updatedAt: new Date(2026, 9, 17, 19, 0).toISOString(),
    });
    expect(historyRow(game, now)).toEqual({ type: 'Trening · Free run', result: 'Anna · 12 rzutek · średnia 45,00', status: 'ended', statusLabel: 'Zakończony', date: 'wczoraj' });
  });

  it('marks a game in progress', () => {
    expect(historyRow(listItem(), now)).toMatchObject({ result: 'Anna 0 : 0 Bartek', status: 'in_progress', statusLabel: 'W trakcie' });
  });
});
