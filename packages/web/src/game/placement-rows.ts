import type { Fixture, TournamentView } from '@autoscore/schema';
import { pl } from '../i18n/pl';

export interface PlacementRow {
  readonly place: number;
  readonly playerId: string | null; // null, gdy miejsce dopiero rozstrzygnie mecz
  readonly text: string;
}

function decided(fixture: Fixture): boolean {
  return fixture.status === 'finished' || fixture.status === 'walkover';
}

function sourceName(fixture: Fixture): string {
  return fixture.phase === 'playoff' ? pl.placementSource[fixture.bracketRound ?? 'final'] : pl.placementSource[fixture.phase];
}

// Ostatni rozegrany mecz gracza. Zwycięzca dostaje też wynik, od swojej strony.
function knownText(view: TournamentView, playerId: string): string {
  const last = view.fixtures
    .filter((fixture) => decided(fixture) && fixture.slots.some((slot) => slot.kind === 'player' && slot.playerId === playerId))
    .reduce<Fixture | null>((latest, fixture) => (latest === null || fixture.number > latest.number ? fixture : latest), null);
  if (!last?.result) {
    return '';
  }
  const name = sourceName(last);
  if (last.result.winnerId !== playerId) {
    return name;
  }
  const [first, second] = last.result.legs;
  const winnerFirst = last.slots[0].kind === 'player' && last.slots[0].playerId === playerId;
  return pl.placementWithScore(name, winnerFirst ? pl.legsCell(first, second) : pl.legsCell(second, first));
}

interface Pending {
  readonly fixture: Fixture | undefined;
  readonly firstPlace: number;
  readonly text: string;
}

// Miejsca znane z widoku i te, o których jeszcze rozstrzygnie finał, mecz o 3. miejsce albo finał pocieszenia.
export function placementRows(view: TournamentView): PlacementRow[] {
  const rows: PlacementRow[] = view.placements.map(({ playerId, place }) => ({ place, playerId, text: knownText(view, playerId) }));
  const advance = view.config.advance ?? 0;
  const pending: Pending[] = [
    {
      fixture: view.fixtures.find((fixture) => fixture.phase === 'playoff' && fixture.bracketRound === 'final'),
      firstPlace: 1,
      text: pl.placementPending(pl.placementSource.final),
    },
    {
      fixture: view.fixtures.find((fixture) => fixture.phase === 'third_place'),
      firstPlace: 3,
      text: pl.placementPending(pl.placementSource.third_place),
    },
    {
      fixture: view.fixtures.find((fixture) => fixture.phase === 'consolation' && fixture.bracketRound === 'final'),
      firstPlace: advance + 1,
      text: pl.placementPending(pl.placementSource.consolation),
    },
  ];
  const known = new Set(view.placements.map((placement) => placement.place));
  for (const { fixture, firstPlace, text } of pending) {
    if (!fixture || decided(fixture)) {
      continue;
    }
    for (const place of [firstPlace, firstPlace + 1]) {
      if (!known.has(place)) {
        rows.push({ place, playerId: null, text });
      }
    }
  }
  // Sortowanie jest stabilne, więc wspólne miejsca zostają w kolejności z widoku.
  return rows.sort((first, second) => first.place - second.place);
}
