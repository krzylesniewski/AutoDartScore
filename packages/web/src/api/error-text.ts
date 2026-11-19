import { pl } from '../i18n/pl';
import { ApiRequestError } from './client';

// Komunikat serwera jest po angielsku, więc na ekran trafia tylko polski tekst wybrany po kodzie.
const TEXT_BY_CODE: Readonly<Record<string, string>> = {
  invalid_request: pl.invalidRequest,
  invalid_config: pl.invalidRequest,
  unknown_player: pl.unknownPlayer,
  archived_player: pl.archivedPlayer,
  tournament_active: pl.tournamentActive,
  fixture_not_ready: pl.fixtureNotReady,
  tournament_started: pl.tournamentStarted,
  tournament_archived: pl.tournamentArchived,
  stale_state: pl.staleState,
  dependent_started: pl.dependentStarted,
  fixture_not_finished: pl.fixtureNotFinished,
  invalid_result: pl.invalidResult,
  already_withdrawn: pl.alreadyWithdrawn,
  tournament_finished: pl.tournamentAlreadyFinished,
  tournament_not_finished: pl.tournamentNotFinished,
  not_a_participant: pl.notAParticipant,
};

export function apiErrorText(caught: unknown): string {
  if (caught instanceof ApiRequestError) {
    return TEXT_BY_CODE[caught.code] ?? pl.requestFailed;
  }
  return pl.requestFailed;
}
