import { describe, expect, it } from 'vitest';
import { pl } from '../i18n/pl';
import { ApiRequestError } from './client';
import { apiErrorText } from './error-text';

describe('apiErrorText', () => {
  it.each([
    ['a 500 internal_error', new ApiRequestError(500, 'internal_error', 'Internal server error'), pl.requestFailed],
    ['a 400 invalid_request', new ApiRequestError(400, 'invalid_request', 'Invalid request: name: Too big'), pl.invalidRequest],
    ['an invalid_config', new ApiRequestError(400, 'invalid_config', 'Invalid config'), pl.invalidRequest],
    ['an unknown_player', new ApiRequestError(400, 'unknown_player', 'Unknown player p2'), pl.unknownPlayer],
    ['an archived_player', new ApiRequestError(400, 'archived_player', 'Player p2 is archived'), pl.archivedPlayer],
    ['a 409 tournament_active', new ApiRequestError(409, 'tournament_active', 'Another tournament is in progress'), pl.tournamentActive],
    ['an unknown code', new ApiRequestError(418, 'teapot', 'I am a teapot'), pl.requestFailed],
    ['an unparsed body', new ApiRequestError(502, 'http_error', 'HTTP 502'), pl.requestFailed],
    ['a network TypeError', new TypeError('Failed to fetch'), pl.requestFailed],
  ])('maps %s to Polish text', (_name, caught, text) => {
    expect(apiErrorText(caught)).toBe(text);
  });

  it('uses the Polish texts for the tournament codes', () => {
    expect(apiErrorText(new ApiRequestError(409, 'tournament_active', 'x'))).toBe(
      'Trwa już inny turniej. Dokończ go, zanim zaczniesz nowy.',
    );
    expect(apiErrorText(new ApiRequestError(400, 'archived_player', 'x'))).toMatch(/zarchiwizowany/);
  });

  it.each([
    ['fixture_not_ready', 'Ten mecz nie jest jeszcze gotowy do gry.'],
    ['tournament_started', 'Pierwszy mecz już się zaczął, losowania nie da się powtórzyć.'],
    ['tournament_archived', 'Turniej jest zarchiwizowany.'],
    ['stale_state', 'Dane zmieniły się na innym urządzeniu. Sprawdź stan i spróbuj ponownie.'],
  ])('maps the 409 %s to Polish text', (code, text) => {
    expect(apiErrorText(new ApiRequestError(409, code, 'x'))).toBe(text);
  });

  it.each([
    [409, 'dependent_started', 'Zaczął się już mecz zależny od tego wyniku, więc wyniku nie da się poprawić.'],
    [409, 'fixture_not_finished', 'Poprawić można tylko zakończony mecz.'],
    [400, 'invalid_result', 'Zwycięzca musi mieć dokładnie tyle legów, ile wymaga mecz, a przegrany mniej.'],
    [409, 'already_withdrawn', 'Ten gracz jest już wycofany.'],
    [409, 'tournament_finished', 'Turniej jest już zakończony.'],
    [409, 'tournament_not_finished', 'Zarchiwizować można tylko zakończony turniej.'],
    [400, 'not_a_participant', 'Ten gracz nie gra w turnieju.'],
  ])('maps the %i %s of the incident commands to Polish text', (status, code, text) => {
    expect(apiErrorText(new ApiRequestError(status, code, 'x'))).toBe(text);
  });
});
