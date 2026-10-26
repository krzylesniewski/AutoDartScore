import type { MatchListItem } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { checkoutPracticeName, formatCheckoutPercent } from './checkout-practice';
import { formatAverage } from './format-stat';

export interface UnfinishedRow {
  readonly title: string;
  readonly detail: string;
  readonly state: string;
}

type Game = Pick<MatchListItem, 'type' | 'practiceMode' | 'startingScore' | 'legsToWin' | 'legIndex' | 'players' | 'freeRun' | 'checkouts'>;

// Teksty wiersza na liście gier do dokończenia.
export function unfinishedRow(game: Game): UnfinishedRow {
  const [first, second] = game.players;
  const startingScore = game.startingScore ?? 0;

  if (game.type === 'match') {
    return {
      title: pl.matchTitle(first?.name ?? '', second?.name ?? ''),
      detail: pl.matchDetail(startingScore, game.legIndex + 1, (game.legsToWin ?? 1) * 2 - 1),
      state: pl.legsState(first?.legsWon ?? 0, second?.legsWon ?? 0),
    };
  }

  if (game.type === 'casual') {
    const playing = game.players.filter((player) => player.place === null);
    // Sortowanie jest stabilne, więc przy remisie prowadzi wcześniejszy w kolejności gracz.
    const leader = [...playing].sort((a, b) => (a.remaining ?? 0) - (b.remaining ?? 0))[0];
    return {
      title: pl.casualTitle(game.players.length),
      detail: leader ? pl.casualDetail(startingScore, leader.name, leader.remaining ?? 0) : String(startingScore),
      state: pl.casualState(playing.length),
    };
  }

  const name = first?.name ?? '';
  if (game.practiceMode === 'solo_501') {
    const remaining = first?.remaining ?? 0;
    return { title: pl.practiceTitle(pl.solo501), detail: pl.soloDetail(name, remaining), state: String(remaining) };
  }
  if (game.practiceMode === 'checkouts') {
    const counts = { attempts: game.checkouts?.attempts ?? 0, successes: game.checkouts?.successes ?? 0 };
    return {
      title: pl.practiceTitle(checkoutPracticeName(game.checkouts)),
      detail: pl.checkoutDetail(name, counts.successes, counts.attempts),
      state: formatCheckoutPercent(counts),
    };
  }
  return {
    title: pl.practiceTitle(pl.freeRun),
    detail: pl.freeRunDetail(name, game.freeRun?.dartsThrown ?? 0),
    state: formatAverage(game.freeRun?.average ?? null),
  };
}
