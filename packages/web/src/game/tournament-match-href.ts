export type MatchHref = (tournamentId: string, matchId: string) => string;

export function tournamentMatchHref(tournamentId: string, matchId: string): string {
  return `#/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}`;
}

export function publicTournamentHref(tournamentId: string): string {
  return `#/t/${encodeURIComponent(tournamentId)}`;
}

export function publicTournamentMatchHref(tournamentId: string, matchId: string): string {
  return `${publicTournamentHref(tournamentId)}/matches/${encodeURIComponent(matchId)}`;
}
