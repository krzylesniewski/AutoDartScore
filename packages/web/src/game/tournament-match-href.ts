export function tournamentMatchHref(tournamentId: string, matchId: string): string {
  return `#/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}`;
}
