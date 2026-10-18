import { replayGame, type ApplyResult, type GameConfig, type GameState } from '@autoscore/engine';
import { StartingScore, type Abandonment, type ThrowRecord } from '@autoscore/schema';
import type { MatchLog, StoredMatch } from './store/store.js';

// Rzutki, które nadal się liczą: każdy wpis undo zdejmuje ostatnią z nich. Porzucenie, wznowienie i koniec treningu nie zmieniają rzutek.
export function effectiveThrows(log: MatchLog): ThrowRecord[] {
  const throws: ThrowRecord[] = [];
  for (const entry of log.entries) {
    if (entry.type === 'throw') {
      const record = log.throws.get(entry.throwId);
      if (!record) {
        throw new Error(`Corrupt log: throw ${entry.throwId} at seq ${entry.seq} is missing`);
      }
      throws.push(record);
    } else if (entry.type === 'undo' && throws.pop()?.id !== entry.throwId) {
      throw new Error(`Corrupt log: undo at seq ${entry.seq} does not match the last effective throw`);
    }
  }
  return throws;
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
      return required(match.practiceMode, 'practice_mode', match.id) === 'solo_501'
        ? { type: 'practice', practiceMode: 'solo_501', playerId }
        : { type: 'practice', practiceMode: 'free_run', playerId };
    }
  }
}

// Stan gry zawsze z odtworzenia logu, bez osobnej pamięci podręcznej stanu.
export function replayMatch(match: StoredMatch, throws: readonly ThrowRecord[]): ApplyResult<GameState> {
  return replayGame(
    gameConfig(match),
    throws.map(({ segment, multiplier }) => ({ segment, multiplier })),
  );
}
