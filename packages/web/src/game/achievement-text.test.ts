import type { Achievement, AchievementKind } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { achievementText } from './achievement-text';

function achievement(kind: AchievementKind, value: number, previous: number | null): Achievement {
  return { type: 'achievement', matchId: 'm_1', eventSeq: 5, playerId: 'anna', kind, value, previous };
}

describe('achievementText', () => {
  it.each<[AchievementKind, number, number | null, string]>([
    ['turn_record', 140, 121, 'Rekord tury: 140 (było 121)'],
    ['checkout_record', 121, 100, 'Rekord zamknięcia: 121 (było 100)'],
    ['shortest_leg', 15, 18, 'Najkrótszy leg: 15 lotek (było 18)'],
    ['shortest_leg', 22, 24, 'Najkrótszy leg: 22 lotki (było 24)'],
    ['longest_leg', 42, 39, 'Najdłuższy leg: 42 lotki (było 39)'],
    ['longest_leg', 51, 42, 'Najdłuższy leg: 51 lotek (było 42)'],
    ['first_100', 105, null, 'Pierwsza tura 100+: 105'],
    ['first_120', 125, null, 'Pierwsza tura 120+: 125'],
    ['first_140', 177, null, 'Pierwsza tura 140+: 177'],
    ['first_180', 180, null, 'Pierwsze 180!'],
  ])('describes %s %i', (kind, value, previous, expected) => {
    expect(achievementText(achievement(kind, value, previous))).toBe(expected);
  });

  it('leaves out the previous value of a record without one', () => {
    expect(achievementText(achievement('turn_record', 100, null))).toBe('Rekord tury: 100');
  });
});
