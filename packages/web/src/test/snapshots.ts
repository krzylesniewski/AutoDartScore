import type { CheckoutAttempt, CheckoutSession, LegProgress, MatchListItem, MatchSnapshot, MatchSnapshotPlayer, MatchSummary, MatchSummaryPlayer, Player, PlayerStatLine } from '@autoscore/schema';

export function player(id: string, name: string, overrides: Partial<MatchSnapshotPlayer> = {}): MatchSnapshotPlayer {
  return { id, name, avatar: null, color: 1, guest: false, remaining: 501, legsWon: null, place: null, dartsThrownInLeg: 0, ...overrides };
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
    checkouts: null,
    status: overrides.finished ? 'finished' : 'in_progress',
    abandonment: null,
    endedAt: null,
    finishedAt: null,
    editableUntil: null,
    round: 1,
    startedAt: null,
    legStartedAt: null,
    pausedMs: 0,
    legPausedMs: 0,
    ...overrides,
  };
}

// Liczniki wynikają z historii, tak jak wymaga schemat.
export function checkoutSession(history: readonly CheckoutAttempt[] = [], overrides: Partial<Pick<CheckoutSession, 'range' | 'target'>> = {}): CheckoutSession {
  return { range: '2-50', target: 40, attempts: history.length, successes: history.filter((attempt) => attempt.success).length, history: [...history], ...overrides };
}

// Kolejne próby z podanych wyników, na celach 2, 3, 4 i dalej.
export function checkoutHistory(results: readonly boolean[]): CheckoutAttempt[] {
  return results.map((success, index) => ({ target: index + 2, success }));
}

// Trening końcówek w kształcie snapshotu z serwera: bez wyniku, kolejki i zegara lega.
export function checkoutPractice(session: CheckoutSession = checkoutSession(), overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    type: 'practice',
    practiceMode: 'checkouts',
    startingScore: null,
    legsToWin: null,
    countsToStats: false,
    round: null,
    turnIndex: session.attempts,
    players: [player('p1', 'Anna', { remaining: null })],
    checkouts: session,
    ...overrides,
  });
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
    lastLegProgress: null,
    checkouts: null,
    ...overrides,
  };
}

// Każdy gracz dostaje kolejne punkty z listy pozostałych wyników. Wynik ze znakiem minus oznacza bust.
export function legProgress(lines: Record<string, readonly number[]>, overrides: Partial<Omit<LegProgress, 'players'>> = {}): LegProgress {
  return {
    legIndex: 0,
    startingScore: 301,
    players: Object.entries(lines).map(([playerId, scores]) => ({
      playerId,
      points: scores.map((score, index) => ({ dart: index + 1, remaining: Math.abs(score), bust: score < 0 })),
    })),
    ...overrides,
  };
}

export function listItem(overrides: Partial<MatchListItem> = {}): MatchListItem {
  return {
    id: 'm1',
    type: 'match',
    practiceMode: null,
    startingScore: 501,
    legsToWin: 2,
    createdAt: '2026-10-18T10:00:00.000Z',
    status: 'in_progress',
    abandonment: null,
    currentPlayerId: 'p1',
    legIndex: 0,
    players: [player('p1', 'Anna', { legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    freeRun: null,
    checkouts: null,
    winnerId: null,
    placements: [],
    endedAt: null,
    updatedAt: '2026-10-18T10:05:00.000Z',
    ...overrides,
  };
}

export function profile(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return { id, name, avatar: null, color: 1, guest: false, archivedAt: null, createdAt: '2026-10-15T18:30:00.000Z', ...overrides };
}
