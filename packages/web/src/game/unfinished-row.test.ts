import { describe, expect, it } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { unfinishedRow } from './unfinished-row';

describe('unfinishedRow', () => {
  it('describes a 1v1 with the leg and the legs score', () => {
    const game = snapshot({
      startingScore: 701,
      legsToWin: 2,
      legIndex: 1,
      players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })],
    });
    expect(unfinishedRow(game)).toEqual({ title: 'Anna vs Bartek', detail: 'Mecz 1v1 · 701 · leg 2 z 3', state: '1 : 0' });
  });

  it('counts Best of 5 legs', () => {
    expect(unfinishedRow(snapshot({ legsToWin: 3 })).detail).toBe('Mecz 1v1 · 501 · leg 1 z 5');
  });

  it('names the casual leader among the players without a place', () => {
    const game = snapshot({
      type: 'casual',
      legsToWin: null,
      players: [
        player('p1', 'Anna', { remaining: 0, place: 1 }),
        player('p2', 'Bartek', { remaining: 87 }),
        player('p3', 'Celina', { remaining: 87 }),
        player('p4', 'Darek', { remaining: 140 }),
      ],
    });
    expect(unfinishedRow(game)).toEqual({ title: 'Zabawa, 4 graczy', detail: '501 · prowadzi Bartek (87)', state: '3 os.' });
  });

  it('shows what is left in Solo 501', () => {
    const game = snapshot({ type: 'practice', practiceMode: 'solo_501', legsToWin: null, players: [player('p1', 'Anna', { remaining: 132 })] });
    expect(unfinishedRow(game)).toEqual({ title: 'Trening: Solo 501', detail: 'Anna · zostało 132', state: '132' });
  });

  it('shows darts and the average in Free run', () => {
    const game = snapshot({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      players: [player('p1', 'Anna', { remaining: null })],
      freeRun: { dartsThrown: 22, totalPoints: 500, average: 68.18 },
    });
    expect(unfinishedRow(game)).toEqual({ title: 'Trening: Free run', detail: 'Anna · 22 rzutki', state: '68.18' });
  });
});
