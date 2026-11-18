import type { LegTurn, MatchLeg } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { formatAverage } from './format-stat';
import { hitLabel } from './hit-label';

export interface LegRowSide {
  readonly points: number;
  readonly remainingAfter: number | null;
  readonly bust: boolean;
  readonly checkout: string | null; // etykieta rzutki kończącej lega, tylko w turze zamknięcia
}

export interface LegRow {
  readonly round: number; // od 1
  readonly sides: readonly [LegRowSide | null, LegRowSide | null];
  readonly darts: number;
}

function isCheckoutTurn(leg: MatchLeg, turn: LegTurn): boolean {
  return turn.playerId === leg.winnerId && !turn.bust && turn.remainingAfter === 0;
}

function lastDartLabel(turn: LegTurn): string | null {
  const last = turn.darts.at(-1);
  return last ? hitLabel(last) : null;
}

function side(leg: MatchLeg, turn: LegTurn | undefined): LegRowSide | null {
  if (!turn) {
    return null;
  }
  return {
    points: turn.points,
    remainingAfter: turn.remainingAfter,
    bust: turn.bust,
    checkout: isCheckoutTurn(leg, turn) ? lastDartLabel(turn) : null,
  };
}

// Wiersz r łączy r-tą zamkniętą turę obu graczy. Rzutki liczą się jak rzucone, więc bust po jednej rzutce to 1 rzutka.
// W wierszu zamknięcia kolumna rzutek pokazuje rzutki zwycięzcy, czyli dartsThrown lega, nawet gdy rywal rzucił więcej.
export function legRows(leg: MatchLeg, playerIds: readonly [string, string]): LegRow[] {
  const first = leg.turns.filter((turn) => turn.playerId === playerIds[0]);
  const second = leg.turns.filter((turn) => turn.playerId === playerIds[1]);
  const rows: LegRow[] = [];
  const totals = [0, 0];
  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    const turns = [first[index], second[index]] as const;
    turns.forEach((turn, at) => {
      totals[at] = (totals[at] ?? 0) + (turn?.darts.length ?? 0);
    });
    const sides = [side(leg, turns[0]), side(leg, turns[1])] as const;
    const winnerAt = sides.findIndex((entry) => entry !== null && entry.checkout !== null);
    const darts = winnerAt === -1 ? Math.max(totals[0] ?? 0, totals[1] ?? 0) : (totals[winnerAt] ?? 0);
    rows.push({ round: index + 1, sides, darts });
  }
  return rows;
}

// Zdanie nad tabelą tur. Bez tury zamknięcia (np. niepełne dane) zamknięcie pokazują same punkty.
export function legStory(leg: MatchLeg, names: ReadonlyMap<string, string>): string {
  const number = leg.legIndex + 1;
  const starter = names.get(leg.starterId) ?? '';
  if (leg.winnerId === null || leg.checkout === null || leg.dartsThrown === null) {
    return pl.legStoryRunning(number, starter);
  }
  const winning = leg.turns.findLast((turn) => isCheckoutTurn(leg, turn));
  const checkout = (winning && lastDartLabel(winning)) ?? String(leg.checkout);
  const average = leg.players.find((entry) => entry.playerId === leg.winnerId)?.average ?? null;
  return pl.legStoryWon(number, starter, checkout, leg.dartsThrown, formatAverage(average));
}
