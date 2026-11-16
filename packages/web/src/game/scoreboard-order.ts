import type { MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';

// Grający na górze, rzucający pierwszy. Zakończeni gracze zabawy na dole według miejsca.
export function scoreboardOrder(state: MatchSnapshot): MatchSnapshotPlayer[] {
  const active = state.players.filter((player) => player.place === null);
  const finished = state.players.filter((player) => player.place !== null).sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  const throwerIndex = active.findIndex((player) => player.id === state.currentPlayerId);
  if (throwerIndex <= 0) {
    return [...active, ...finished];
  }
  return [...active.slice(throwerIndex), ...active.slice(0, throwerIndex), ...finished];
}
