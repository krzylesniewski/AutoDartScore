import type { MatchSnapshot, MatchSnapshotPlayer, MatchSummary, MatchSummaryPlayer } from '@autoscore/schema';

export interface CasualPlace {
  place: number;
  player: MatchSnapshotPlayer;
  line: MatchSummaryPlayer | null;
}

export function casualPlaces(state: MatchSnapshot, summary: MatchSummary | null): CasualPlace[] {
  return [...state.placements]
    .sort((a, b) => a.place - b.place)
    .flatMap((placement) => {
      const player = state.players.find((candidate) => candidate.id === placement.playerId);
      if (!player) {
        return [];
      }
      const line = summary?.players.find((candidate) => candidate.playerId === placement.playerId) ?? null;
      return [{ place: placement.place, player, line }];
    });
}
