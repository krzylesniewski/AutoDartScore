import { currentRound, freeRunAverage, isGameFinished, SOLO_501_STARTING_SCORE, type GameState } from '@autoscore/engine';
import type { Abandonment, MatchSnapshot, MatchSnapshotPlayer, MatchStatus, Player } from '@autoscore/schema';
import type { GameTimes } from './replay.js';
import type { StoredMatch } from './store/store.js';

type Progress = Pick<MatchSnapshot, 'currentPlayerId' | 'legIndex' | 'turnIndex' | 'currentDarts' | 'winnerId' | 'placements' | 'freeRun'> & {
  readonly startingScore: number | null;
  readonly perPlayer: (player: Player, index: number) => Pick<MatchSnapshotPlayer, 'remaining' | 'legsWon' | 'place' | 'dartsThrownInLeg'>;
};

function progress(game: GameState, finished: boolean): Progress {
  switch (game.type) {
    case 'match': {
      const { state } = game;
      const { playerIds } = state.config;
      return {
        startingScore: state.config.startingScore,
        currentPlayerId: finished ? null : playerIds[state.currentPlayerIndex],
        legIndex: state.legIndex,
        turnIndex: state.turnIndex,
        currentDarts: [...state.currentDarts],
        winnerId: state.winnerIndex === null ? null : playerIds[state.winnerIndex],
        placements: [],
        freeRun: null,
        perPlayer: (_player, index) => ({
          remaining: state.remaining[index] ?? null,
          legsWon: state.legsWon[index] ?? null,
          place: null,
          dartsThrownInLeg: state.dartsThrownInLeg[index] ?? 0,
        }),
      };
    }
    case 'casual': {
      const { state } = game;
      return {
        startingScore: state.config.startingScore,
        currentPlayerId: finished ? null : (state.config.playerIds[state.currentPlayerIndex] ?? null),
        legIndex: 0,
        turnIndex: state.turnIndex,
        currentDarts: [...state.currentDarts],
        winnerId: null,
        placements: [...state.placements],
        freeRun: null,
        perPlayer: (player, index) => ({
          remaining: state.remaining[index] ?? null,
          legsWon: null,
          place: state.placements.find((placement) => placement.playerId === player.id)?.place ?? null,
          dartsThrownInLeg: state.dartsThrownInLeg[index] ?? 0,
        }),
      };
    }
    case 'practice': {
      if (game.practiceMode === 'solo_501') {
        const { state } = game;
        return {
          startingScore: SOLO_501_STARTING_SCORE,
          currentPlayerId: finished ? null : state.config.playerId,
          legIndex: 0,
          turnIndex: state.turnIndex,
          currentDarts: [...state.currentDarts],
          winnerId: finished ? state.config.playerId : null,
          placements: [],
          freeRun: null,
          perPlayer: () => ({ remaining: state.remaining, legsWon: null, place: null, dartsThrownInLeg: state.dartsThrown }),
        };
      }
      const { state } = game;
      return {
        startingScore: null,
        currentPlayerId: state.config.playerId,
        legIndex: 0,
        turnIndex: state.turnIndex,
        currentDarts: [...state.currentDarts],
        winnerId: null,
        placements: [],
        freeRun: { dartsThrown: state.dartsThrown, totalPoints: state.totalPoints, average: freeRunAverage(state) },
        perPlayer: () => ({ remaining: null, legsWon: null, place: null, dartsThrownInLeg: state.dartsThrown }),
      };
    }
  }
}

function status(finished: boolean, abandonment: Abandonment | null, endedAt: string | null): MatchStatus {
  if (finished) {
    return 'finished';
  }
  if (endedAt) {
    return 'ended';
  }
  return abandonment ? 'abandoned' : 'in_progress';
}

export interface SnapshotTimes extends GameTimes {
  readonly abandonment: Abandonment | null;
  readonly endedAt: string | null;
  readonly finishedAt: string | null;
  readonly lockMs: number;
}

// Porzucona gra i zakończony trening zachowują rzucającego i rzutki tury, żeby podgląd pokazywał stan z chwili przerwania.
export function toSnapshot(
  match: StoredMatch,
  game: GameState,
  eventSeq: number,
  { abandonment, endedAt, finishedAt, lockMs, startedAt, legStartedAt, pausedMs, legPausedMs }: SnapshotTimes,
): MatchSnapshot {
  const finished = isGameFinished(game);
  const { perPlayer, startingScore, ...rest } = progress(game, finished);
  return {
    id: match.id,
    type: match.type,
    practiceMode: match.practiceMode,
    startingScore,
    legsToWin: match.legsToWin,
    countsToStats: match.countsToStats,
    createdAt: match.createdAt,
    finished,
    status: status(finished, abandonment, endedAt),
    abandonment,
    endedAt,
    finishedAt,
    editableUntil: finishedAt === null ? null : new Date(Date.parse(finishedAt) + lockMs).toISOString(),
    round: currentRound(game),
    startedAt,
    legStartedAt,
    pausedMs,
    legPausedMs,
    eventSeq,
    ...rest,
    players: match.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      color: player.color,
      guest: player.guest,
      ...perPlayer(player, index),
    })),
  };
}
