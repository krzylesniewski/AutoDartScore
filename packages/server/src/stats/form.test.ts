import { FORM_GAMES } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { buildForm, type FormGame } from './form.js';

// Leg z 3 rzutkami, więc średnia na 3 rzutki równa się punktom.
function game(index: number, averages: readonly number[]): FormGame {
  return {
    matchId: `m${index}`,
    type: 'match',
    createdAt: new Date(Date.UTC(2026, 9, 1, 18, index)).toISOString(),
    legs: averages.map((points, legIndex) => ({ playerId: 'anna', legIndex, points, darts: 3 })),
  };
}

describe('buildForm', () => {
  it('gives no points without games', () => {
    expect(buildForm([])).toEqual([]);
  });

  it('averages the completed legs of each game, oldest first', () => {
    expect(buildForm([game(1, [60, 40]), game(2, [81])])).toEqual([
      { matchId: 'm1', type: 'match', createdAt: '2026-10-01T18:01:00.000Z', average: 50, legs: 2 },
      { matchId: 'm2', type: 'match', createdAt: '2026-10-01T18:02:00.000Z', average: 81, legs: 1 },
    ]);
  });

  it('skips a game whose only leg was interrupted', () => {
    expect(buildForm([game(1, [60]), game(2, []), game(3, [45])]).map((point) => point.matchId)).toEqual(['m1', 'm3']);
  });

  it(`keeps the newest ${FORM_GAMES} games`, () => {
    const games = Array.from({ length: FORM_GAMES + 5 }, (_, index) => game(index, [index]));
    const points = buildForm(games);
    expect(points).toHaveLength(FORM_GAMES);
    expect(points[0]?.matchId).toBe('m5');
    expect(points.at(-1)?.matchId).toBe(`m${FORM_GAMES + 4}`);
  });

  it('counts only games with a completed leg towards the cut', () => {
    const games = [...Array.from({ length: FORM_GAMES }, (_, index) => game(index, [50])), game(FORM_GAMES, [])];
    expect(buildForm(games)).toHaveLength(FORM_GAMES);
    expect(buildForm(games)[0]?.matchId).toBe('m0');
  });
});
