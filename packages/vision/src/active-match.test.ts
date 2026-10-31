import type { MatchListItem } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { pickActiveMatch } from './active-match.js';

function item(id: string, overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id,
    type: 'match',
    practiceMode: null,
    startingScore: 301,
    legsToWin: 1,
    createdAt: '2026-10-29T18:00:00.000Z',
    status: 'in_progress',
    abandonment: null,
    currentPlayerId: 'p1',
    legIndex: 0,
    players: [{ id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false, remaining: 301, legsWon: 0, place: null, dartsThrownInLeg: 0 }],
    freeRun: null,
    checkouts: null,
    winnerId: null,
    placements: [],
    endedAt: null,
    updatedAt: '2026-10-29T18:00:00.000Z',
    ...overrides,
  };
}

describe('pickActiveMatch', () => {
  it('picks the newest game in progress', () => {
    expect(pickActiveMatch([item('m3'), item('m2'), item('m1')])?.id).toBe('m3');
  });

  it('skips abandoned games', () => {
    expect(pickActiveMatch([item('m3', { status: 'abandoned' }), item('m2'), item('m1')])?.id).toBe('m2');
  });

  it('gives null when the newest game in progress is a checkout practice', () => {
    const checkouts = item('m3', { type: 'practice', practiceMode: 'checkouts', startingScore: null, legsToWin: null });
    expect(pickActiveMatch([checkouts, item('m2')])).toBeNull();
  });

  it('gives null for an empty list', () => {
    expect(pickActiveMatch([])).toBeNull();
  });

  it('gives null when every game is abandoned', () => {
    expect(pickActiveMatch([item('m1', { status: 'abandoned' })])).toBeNull();
  });
});
