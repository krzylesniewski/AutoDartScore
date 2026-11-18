import type { FixtureSlot, PublicTournamentPlayer, PublicTournamentView } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { fixtureOrdinal } from './fixture-label';

export function slotPlayer(view: PublicTournamentView, slot: FixtureSlot): PublicTournamentPlayer | null {
  if (slot.kind !== 'player') {
    return null;
  }
  return view.players.find((player) => player.id === slot.playerId) ?? null;
}

// Wolny los ma własny napis. Zwycięzca innego meczu albo miejsce z tabeli jeszcze nie ma gracza.
export function slotText(view: PublicTournamentView, slot: FixtureSlot): string {
  const player = slotPlayer(view, slot);
  if (player) {
    return player.name;
  }
  return slot.kind === 'bye' ? pl.slotBye : pl.slotPending;
}

// Dopełniacz meczu, z którego przyjdzie gracz: „półfinału 2”, „ćwierćfinału 3 (pocieszenie)”.
function sourceFixture(view: PublicTournamentView, fixtureId: string): string | null {
  const source = view.fixtures.find((fixture) => fixture.id === fixtureId);
  if (!source?.bracketRound) {
    return null;
  }
  const genitive = pl.roundGenitive[source.bracketRound];
  const name = source.bracketRound === 'final' ? genitive : `${genitive} ${fixtureOrdinal(source.id)}`;
  return source.phase === 'consolation' ? pl.ofConsolation(name) : name;
}

// W drabince slot bez gracza mówi, skąd gracz przyjdzie.
export function slotSourceText(view: PublicTournamentView, slot: FixtureSlot): string {
  switch (slot.kind) {
    case 'player':
      return slotPlayer(view, slot)?.name ?? pl.slotPending;
    case 'bye':
      return pl.slotBye;
    case 'standing':
      return pl.slotStanding(slot.place);
    case 'winner_of':
    case 'loser_of': {
      const source = sourceFixture(view, slot.fixtureId);
      if (source === null) {
        return pl.slotPending;
      }
      return slot.kind === 'winner_of' ? pl.slotWinnerOf(source) : pl.slotLoserOf(source);
    }
  }
}
