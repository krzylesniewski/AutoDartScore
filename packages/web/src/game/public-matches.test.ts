import { describe, expect, it } from 'vitest';
import { fixture } from '../test/snapshots';
import { publicMatchFixtures } from './public-matches';

describe('publicMatchFixtures', () => {
  it('keeps finished and running fixtures with a match, from the highest number', () => {
    const fixtures = [
      fixture({ id: 'g-1', number: 1, status: 'finished', matchId: 'm-1', result: { legs: [3, 1], winnerId: 'p1', corrected: false } }),
      fixture({ id: 'g-2', number: 2, status: 'in_progress', matchId: 'm-2' }),
      fixture({ id: 'g-3', number: 3, status: 'ready' }),
      fixture({ id: 'g-4', number: 4, status: 'walkover', matchId: 'm-4', result: { legs: [3, 0], winnerId: 'p1', corrected: false } }),
      fixture({ id: 'g-5', number: 5, status: 'walkover', result: { legs: [3, 0], winnerId: 'p1', corrected: false } }),
      fixture({ id: 'g-6', number: 6, status: 'finished', matchId: 'm-6', result: { legs: [3, 2], winnerId: 'p2', corrected: true } }),
    ];
    expect(publicMatchFixtures({ fixtures }).map((entry) => entry.id)).toEqual(['g-6', 'g-2', 'g-1']);
  });

  it('is empty before the first match starts', () => {
    expect(publicMatchFixtures({ fixtures: [fixture()] })).toEqual([]);
  });
});
