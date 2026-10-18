import type { MatchSnapshot, MatchSnapshotPlayer, MatchSummary, MatchSummaryPlayer, PlayerStatLine } from '@autoscore/schema';

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
    status: overrides.finished ? 'finished' : 'in_progress',
    abandonment: null,
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

export function statLine(overrides: Partial<PlayerStatLine> = {}): PlayerStatLine {
  return {
    dartsThrown: 0,
    points: 0,
    average: null,
    first9Average: null,
    scores180: 0,
    scores140: 0,
    scores100: 0,
    scores60: 0,
    highestCheckout: null,
    doubleAttempts: 0,
    doublesHit: 0,
    doublesPercent: null,
    bestLegDarts: null,
    legsWon: 0,
    ...overrides,
  };
}

export function summaryPlayer(playerId: string, overrides: Partial<PlayerStatLine> = {}): MatchSummaryPlayer {
  return { ...statLine(overrides), playerId };
}

export function summary(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    matchId: 'm1',
    type: 'match',
    finished: false,
    eventSeq: 0,
    players: [summaryPlayer('p1'), summaryPlayer('p2')],
    legs: [],
    ...overrides,
  };
}
