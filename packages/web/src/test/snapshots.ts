import type { MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';

export function player(id: string, name: string, overrides: Partial<MatchSnapshotPlayer> = {}): MatchSnapshotPlayer {
  return { id, name, avatar: null, guest: false, remaining: 501, legsWon: null, place: null, dartsThrownInLeg: 0, ...overrides };
}

export function snapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    id: 'm1',
    type: 'match',
    practiceMode: null,
    startingScore: 501,
    legsToWin: 2,
    countsToStats: true,
    createdAt: '2026-10-15T18:30:00.000Z',
    finished: false,
    eventSeq: 0,
    currentPlayerId: 'p1',
    legIndex: 0,
    turnIndex: 0,
    currentDarts: [],
    players: [player('p1', 'Anna', { legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    winnerId: null,
    placements: [],
    freeRun: null,
    ...overrides,
  };
}

export function casual(names: readonly string[], overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    type: 'casual',
    legsToWin: null,
    players: names.map((name, index) => player(`p${index + 1}`, name)),
    ...overrides,
  });
}
