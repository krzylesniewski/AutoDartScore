import type { FixtureSlot, TournamentPlayer, TournamentView } from '@autoscore/schema';
import { pl } from '../i18n/pl';

export function slotPlayer(view: TournamentView, slot: FixtureSlot): TournamentPlayer | null {
  if (slot.kind !== 'player') {
    return null;
  }
  return view.players.find((player) => player.id === slot.playerId) ?? null;
}

// Wolny los ma własny napis. Zwycięzca innego meczu albo miejsce z tabeli jeszcze nie ma gracza.
export function slotText(view: TournamentView, slot: FixtureSlot): string {
  const player = slotPlayer(view, slot);
  if (player) {
    return player.name;
  }
  return slot.kind === 'bye' ? pl.slotBye : pl.slotPending;
}
