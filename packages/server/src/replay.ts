import {
  dartsInCurrentLeg,
  replayGame,
  replayThrowLog,
  type CheckoutStep,
  type GameConfig,
  type GameState,
  type ThrowLogStep,
} from '@autoscore/engine';
import { StartingScore, type Abandonment, type DomainEvent, type MatchSnapshot, type ReviewedThrow, type ThrowRecord, type ThrowReview } from '@autoscore/schema';
import type { LogEntry, MatchLog, StoredMatch } from './store/store.js';

// Próby i pominięcia checkoutu, które nadal się liczą, w kolejności z logu. Każde cofnięcie zdejmuje ostatni krok,
// który musi być tego samego rodzaju co cofnięcie.
export function effectiveCheckoutSteps(log: MatchLog): CheckoutStep[] {
  const steps: CheckoutStep[] = [];
  for (const entry of log.entries) {
    if (entry.type === 'checkout_attempt') {
      steps.push({ type: 'attempt', success: entry.success });
    } else if (entry.type === 'checkout_skipped') {
      steps.push({ type: 'skip' });
    } else if (entry.type === 'checkout_attempt_undone' && steps.pop()?.type !== 'attempt') {
      throw new Error(`Corrupt log: checkout_attempt_undone at seq ${entry.seq} does not match the last effective attempt`);
    } else if (entry.type === 'checkout_skip_undone' && steps.pop()?.type !== 'skip') {
      throw new Error(`Corrupt log: checkout_skip_undone at seq ${entry.seq} does not match the last effective skip`);
    }
  }
  return steps;
}

// Otwarte porzucenie albo null, gdy gra nie jest porzucona.
export function abandonment(log: MatchLog): Abandonment | null {
  let open: Abandonment | null = null;
  for (const entry of log.entries) {
    if (entry.type === 'match_abandoned') {
      if (open) {
        throw new Error(`Corrupt log: match_abandoned at seq ${entry.seq} while the match is already abandoned`);
      }
      open = { playerId: entry.playerId, reason: entry.reason, at: entry.createdAt };
    } else if (entry.type === 'match_resumed') {
      if (!open) {
        throw new Error(`Corrupt log: match_resumed at seq ${entry.seq} without an open abandonment`);
      }
      open = null;
    }
  }
  return open;
}

export type GameTimes = Pick<MatchSnapshot, 'startedAt' | 'legStartedAt' | 'pausedMs' | 'legPausedMs'>;

// Przerwy od porzucenia do wznowienia. Otwarte porzucenie jeszcze nie jest przerwą, bo nie wiadomo, kiedy się skończy.
function closedPauses(log: MatchLog): { start: number; end: number }[] {
  const pauses: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (const entry of log.entries) {
    if (entry.type === 'match_abandoned') {
      start = Date.parse(entry.createdAt);
    } else if (entry.type === 'match_resumed' && start !== null) {
      pauses.push({ start, end: Date.parse(entry.createdAt) });
      start = null;
    }
  }
  return pauses;
}

// Liczy się tylko część przerwy po starcie, więc przerwa przed pierwszą rzutką lega nie wydłuża lega.
function pausedSince(pauses: readonly { start: number; end: number }[], from: string | null): number {
  if (from === null) {
    return 0;
  }
  const fromMs = Date.parse(from);
  return pauses.reduce((sum, { start, end }) => sum + Math.max(0, end - Math.max(start, fromMs)), 0);
}

// Czasy gry i bieżącego lega wyłącznie z receivedAt rzutek i createdAt wpisów w logu.
export function gameTimes(log: MatchLog, throws: readonly ThrowRecord[], game: GameState): GameTimes {
  const startedAt = throws[0]?.receivedAt ?? null;
  const legDarts = dartsInCurrentLeg(game);
  const legStartedAt = legDarts > 0 ? (throws[throws.length - legDarts]?.receivedAt ?? null) : null;
  const pauses = closedPauses(log);
  return { startedAt, legStartedAt, pausedMs: pausedSince(pauses, startedAt), legPausedMs: pausedSince(pauses, legStartedAt) };
}

// Czas zakończenia treningu albo null, gdy trening trwa.
export function practiceEndedAt(log: MatchLog): string | null {
  let endedAt: string | null = null;
  for (const entry of log.entries) {
    if (entry.type === 'practice_ended') {
      if (endedAt) {
        throw new Error(`Corrupt log: practice_ended at seq ${entry.seq} while the practice is already ended`);
      }
      endedAt = entry.createdAt;
    }
  }
  return endedAt;
}

export function lastSeq(log: MatchLog): number {
  return log.entries.at(-1)?.seq ?? 0;
}

export function lastActivityAt(log: MatchLog, match: StoredMatch): string {
  return log.entries.at(-1)?.createdAt ?? match.createdAt;
}

function required<T>(value: T | null, field: string, matchId: string): T {
  if (value === null) {
    throw new Error(`Corrupt match ${matchId}: ${field} is missing`);
  }
  return value;
}

// Tylko pola, z których powstaje konfiguracja silnika. Dzięki temu da się ją sprawdzić przed zapisem gry.
export type MatchSetup = Omit<StoredMatch, 'countsToStats' | 'createdAt'>;

export function gameConfig(match: MatchSetup): GameConfig {
  const playerIds = match.players.map((player) => player.id);
  switch (match.type) {
    case 'match': {
      const [first, second] = playerIds;
      const firstPlayerIndex = required(match.firstPlayerIndex, 'first_player_index', match.id);
      if (firstPlayerIndex !== 0 && firstPlayerIndex !== 1) {
        throw new Error(`Corrupt match ${match.id}: first_player_index ${firstPlayerIndex} in a 1v1 match`);
      }
      return {
        type: 'match',
        playerIds: [required(first ?? null, 'player 0', match.id), required(second ?? null, 'player 1', match.id)],
        startingScore: StartingScore.parse(match.startingScore),
        legsToWin: required(match.legsToWin, 'legs_to_win', match.id),
        firstPlayerIndex,
      };
    }
    case 'casual':
      return {
        type: 'casual',
        playerIds,
        startingScore: StartingScore.parse(match.startingScore),
        firstPlayerIndex: required(match.firstPlayerIndex, 'first_player_index', match.id),
      };
    case 'practice': {
      const playerId = required(playerIds[0] ?? null, 'player 0', match.id);
      const practiceMode = required(match.practiceMode, 'practice_mode', match.id);
      switch (practiceMode) {
        case 'solo_501':
        case 'free_run':
          return { type: 'practice', practiceMode, playerId };
        case 'checkouts':
          return {
            type: 'practice',
            practiceMode,
            playerId,
            range: required(match.checkoutRange, 'checkout_range', match.id),
            seed: required(match.checkoutSeed, 'checkout_seed', match.id),
            rule: required(match.checkoutRule, 'checkout_rule', match.id),
          };
      }
    }
  }
}

type LoggedStep = { readonly step: ThrowLogStep; readonly entry: LogEntry };

// Kroki silnika z wpisów logu, każdy razem z wpisem, z którego powstał.
function throwLogSteps(log: MatchLog): LoggedStep[] {
  const steps: LoggedStep[] = [];
  for (const entry of log.entries) {
    switch (entry.type) {
      case 'throw': {
        const record = log.throws.get(entry.throwId);
        if (!record) {
          throw new Error(`Corrupt log: throw ${entry.throwId} at seq ${entry.seq} is missing`);
        }
        steps.push({ step: { type: 'throw', throwId: entry.throwId, hit: { segment: record.segment, multiplier: record.multiplier } }, entry });
        break;
      }
      case 'undo':
        steps.push({ step: { type: 'undo', throwId: entry.throwId }, entry });
        break;
      case 'throw_flagged':
        steps.push({ step: { type: 'flag', throwId: entry.throwId }, entry });
        break;
      case 'throw_verified':
        steps.push({ step: { type: 'verify', throwId: entry.throwId, hit: entry.hit }, entry });
        break;
      default:
        break;
    }
  }
  return steps;
}

// Ostatnie oznaczenie każdej rzutki i weryfikacja po nim. Kandydaci, klatki i czubek pochodzą z trafienia.
function throwReviews(log: MatchLog): Map<string, ThrowReview> {
  const reviews = new Map<string, ThrowReview>();
  for (const entry of log.entries) {
    if (entry.type === 'throw_flagged') {
      const { candidates = [], frames, tip } = log.throws.get(entry.throwId)?.review ?? {};
      reviews.set(entry.throwId, {
        reason: entry.reason,
        flaggedBy: entry.actor,
        candidates,
        ...(frames === undefined ? {} : { frames }),
        ...(tip === undefined ? {} : { tip }),
        resolved: null,
      });
    } else if (entry.type === 'throw_verified') {
      const review = reviews.get(entry.throwId);
      if (review) {
        reviews.set(entry.throwId, { ...review, resolved: { ...entry.hit, by: entry.actor, at: entry.createdAt } });
      }
    }
  }
  return reviews;
}

export interface MatchReplay {
  readonly game: GameState;
  readonly events: readonly DomainEvent[];
  readonly counted: readonly ThrowRecord[]; // w kolejności, w jakiej silnik je policzył
  readonly throws: readonly ReviewedThrow[]; // rzutki niecofnięte, w kolejności z logu
  readonly lastTurnThrows: readonly ReviewedThrow[];
  readonly awaitingReview: boolean;
  readonly finishedAt: string | null; // createdAt wpisu, po którym gra się zakończyła
}

// Stan gry zawsze z odtworzenia logu, bez osobnej pamięci podręcznej stanu. extra to kroki jeszcze niezapisane:
// pozwalają sprawdzić komendę w silniku przed zapisem, ale nie mają wpisu, więc finishedAt po nich jest null.
export function replayLog(match: StoredMatch, log: MatchLog, extra: readonly ThrowLogStep[] = []): MatchReplay {
  const config = gameConfig(match);
  const logged = throwLogSteps(log);
  const replay = replayThrowLog(config, [...logged.map(({ step }) => step), ...extra]);
  const checkoutSteps = effectiveCheckoutSteps(log);
  const { state: game, events } = checkoutSteps.length > 0 ? replayGame(config, [], checkoutSteps) : replay;
  const reviews = throwReviews(log);
  const views = new Map<string, ReviewedThrow>();
  for (const { throwId, value, scoring, pending } of replay.throws) {
    const stored = log.throws.get(throwId);
    if (!stored) {
      continue; // rzutka z extra, jeszcze bez zapisu
    }
    views.set(throwId, {
      id: throwId,
      sequence: stored.sequence,
      source: stored.source,
      confidence: stored.confidence,
      reading: { segment: stored.segment, multiplier: stored.multiplier },
      value,
      status: pending ? 'pending' : 'confirmed',
      scoring,
      review: reviews.get(throwId) ?? null,
    });
  }
  const finishedStep = replay.finishedAtStep === null ? undefined : logged[replay.finishedAtStep];
  return {
    game,
    events,
    counted: replay.counted.flatMap((throwId) => log.throws.get(throwId) ?? []),
    throws: [...views.values()],
    lastTurnThrows: replay.lastTurn.flatMap((throwId) => views.get(throwId) ?? []),
    awaitingReview: replay.throws.some((entry) => entry.scoring === 'waiting'),
    finishedAt: finishedStep?.entry.createdAt ?? null,
  };
}
