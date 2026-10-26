import type { MatchListItem } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { formatActivity } from './activity-date';
import { checkoutPracticeName, formatCheckoutPercent } from './checkout-practice';
import { formatAverage } from './format-stat';

export type HistoryStatus = 'finished' | 'in_progress' | 'abandoned' | 'ended';

export interface HistoryRow {
  readonly type: string;
  readonly result: string;
  readonly status: HistoryStatus;
  readonly statusLabel: string;
  readonly date: string;
}

type Game = Pick<MatchListItem, 'type' | 'practiceMode' | 'startingScore' | 'status' | 'players' | 'winnerId' | 'placements' | 'freeRun' | 'checkouts' | 'updatedAt'>;

function typeLabel(game: Game): string {
  const startingScore = game.startingScore ?? 0;
  if (game.type === 'match') {
    return pl.historyTypeMatch(startingScore);
  }
  if (game.type === 'casual') {
    return pl.historyTypeCasual(startingScore);
  }
  if (game.practiceMode === 'checkouts') {
    return pl.historyTypePractice(checkoutPracticeName(game.checkouts));
  }
  return pl.historyTypePractice(game.practiceMode === 'solo_501' ? pl.solo501 : pl.freeRun);
}

function name(game: Game, playerId: string | null): string {
  return game.players.find((player) => player.id === playerId)?.name ?? '';
}

// Najpierw gracze z miejscem, w kolejności miejsc, potem grający dalej w kolejności rzutów.
function casualResult(game: Game): string {
  const placed = [...game.placements].sort((a, b) => a.place - b.place).map((placement) => pl.placedPlayer(placement.place, name(game, placement.playerId)));
  const playing = game.players.filter((player) => !game.placements.some((placement) => placement.playerId === player.id)).map((player) => player.name);
  return [...placed, ...playing].join(' · ');
}

function result(game: Game): string {
  const [first, second] = game.players;
  if (game.type === 'match') {
    return pl.matchResult(first?.name ?? '', first?.legsWon ?? 0, second?.legsWon ?? 0, second?.name ?? '');
  }
  if (game.type === 'casual') {
    return casualResult(game);
  }
  if (game.practiceMode === 'solo_501') {
    return first?.name ?? '';
  }
  if (game.practiceMode === 'checkouts') {
    const counts = { attempts: game.checkouts?.attempts ?? 0, successes: game.checkouts?.successes ?? 0 };
    return pl.checkoutResult(first?.name ?? '', counts.successes, counts.attempts, formatCheckoutPercent(counts));
  }
  return pl.freeRunResult(first?.name ?? '', game.freeRun?.dartsThrown ?? 0, formatAverage(game.freeRun?.average ?? null));
}

function statusLabel(game: Game): string {
  switch (game.status) {
    case 'finished': {
      if (game.type === 'practice') {
        return pl.statusFinished;
      }
      const winnerId = game.type === 'match' ? game.winnerId : (game.placements.find((placement) => placement.place === 1)?.playerId ?? null);
      return winnerId === null ? pl.statusFinished : pl.winnerBadge(name(game, winnerId));
    }
    case 'in_progress':
      return pl.statusInProgress;
    case 'abandoned':
      return pl.statusAbandoned;
    case 'ended':
      return pl.statusEnded;
  }
}

// Teksty wiersza historii gier.
export function historyRow(game: Game, now: Date): HistoryRow {
  return { type: typeLabel(game), result: result(game), status: game.status, statusLabel: statusLabel(game), date: formatActivity(game.updatedAt, now) };
}
