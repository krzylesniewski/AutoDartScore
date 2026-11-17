import type {
  CheckoutAttempt,
  CheckoutSession,
  Fixture,
  LegProgress,
  LegTurn,
  MatchListItem,
  MatchSnapshot,
  MatchSnapshotPlayer,
  MatchSummary,
  MatchSummaryPlayer,
  Player,
  PlayerStatLine,
  StandingRow,
  TournamentListItem,
  TournamentPlayer,
  TournamentView,
} from '@autoscore/schema';

// Domyślnie tura za 60 z 501. Bust bez podanych punktów i wyniku dostaje 0 punktów i wynik startowy, jak w schemacie.
export function legTurn(playerId: string, overrides: Partial<LegTurn> = {}): LegTurn {
  const bust = overrides.bust ?? false;
  return {
    playerId,
    turnIndex: 0,
    darts: [
      { segment: 20, multiplier: 1 },
      { segment: 20, multiplier: 1 },
      { segment: 20, multiplier: 1 },
    ],
    points: bust ? 0 : 60,
    remainingAfter: bust ? 501 : 441,
    bust,
    ...overrides,
  };
}

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
    legTurns: [],
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
    tournament: null,
    ...overrides,
  };
}

// Liczniki wynikają z historii, tak jak wymaga schemat.
export function checkoutSession(
  history: readonly CheckoutAttempt[] = [],
  overrides: Partial<Pick<CheckoutSession, 'range' | 'target' | 'skips'>> = {},
): CheckoutSession {
  return {
    range: '2-50',
    target: 40,
    attempts: history.length,
    successes: history.filter((attempt) => attempt.success).length,
    skips: 0,
    history: [...history],
    ...overrides,
  };
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
    t20Hits: 0,
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
    tournament: null,
    updatedAt: '2026-10-18T10:05:00.000Z',
    ...overrides,
  };
}

export function profile(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return { id, name, avatar: null, color: 1, guest: false, archivedAt: null, createdAt: '2026-10-15T18:30:00.000Z', ...overrides };
}

export function tournamentPlayer(id: string, name: string): TournamentPlayer {
  return { id, name, avatar: null, color: 1, guest: false };
}

// Mecz ligi gotowy do gry między p1 i p2.
export function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 'g-1',
    number: 1,
    phase: 'group',
    round: 1,
    bracketRound: null,
    board: 1,
    legsToWin: 3,
    slots: [
      { kind: 'player', playerId: 'p1', seed: null },
      { kind: 'player', playerId: 'p2', seed: null },
    ],
    status: 'ready',
    matchId: null,
    result: null,
    averages: null,
    ...overrides,
  };
}

// Mecze, bilans i punkty wynikają z wygranych, przegranych i legów, tak jak wymaga schemat.
export function standingRow(playerId: string, place: number, overrides: Partial<StandingRow> = {}): StandingRow {
  const won = overrides.won ?? 0;
  const lost = overrides.lost ?? 0;
  const legsFor = overrides.legsFor ?? 0;
  const legsAgainst = overrides.legsAgainst ?? 0;
  return {
    playerId,
    place,
    played: won + lost,
    won,
    lost,
    legsFor,
    legsAgainst,
    legDifference: legsFor - legsAgainst,
    points: 2 * won,
    average: null,
    withdrawn: false,
    advances: false,
    ...overrides,
  };
}

// Liga trzech graczy w trakcie, bez rozegranych meczów. Tabela i mecze nie muszą wynikać z silnika.
export function tournamentView(overrides: Partial<TournamentView> = {}): TournamentView {
  const players = [tournamentPlayer('p1', 'Anna'), tournamentPlayer('p2', 'Bartek'), tournamentPlayer('p3', 'Celina')];
  return {
    id: 't1',
    name: 'Liga czwartkowa',
    format: 'league',
    config: {
      name: 'Liga czwartkowa',
      format: 'league',
      playerIds: players.map((entry) => entry.id),
      startingScore: 501,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
      sharing: true,
    },
    status: 'in_progress',
    createdAt: '2026-11-12T18:00:00.000Z',
    finishedAt: null,
    players,
    fixtures: [fixture()],
    standings: [],
    nextFixtureId: 'g-1',
    liveFixtureId: null,
    placements: [],
    sharing: true,
    canRedraw: true,
    eventSeq: 1,
    archivedAt: null,
    ...overrides,
  };
}

export function tournamentListItem(overrides: Partial<TournamentListItem> = {}): TournamentListItem {
  const { id, name, format, status, createdAt, finishedAt, archivedAt, players, placements } = tournamentView();
  return { id, name, format, status, createdAt, finishedAt, archivedAt, players, placements, ...overrides };
}
