import { publicTournamentHref } from './tournament-match-href';

export interface SharePage {
  readonly origin: string;
  readonly pathname: string;
}

// Link powstaje z adresu, pod którym organizator ma otwartą aplikację, razem ze ścieżką buildu pod podścieżką serwera.
export function publicTournamentUrl(page: SharePage, tournamentId: string): string {
  return `${page.origin}${page.pathname}${publicTournamentHref(tournamentId)}`;
}

// Taki adres otwiera aplikację tylko na tym samym urządzeniu, więc link i kod QR nie zadziałają na telefonie.
export function isLocalAddress(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
