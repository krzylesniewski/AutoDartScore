import type { Fixture, TournamentFormat } from '@autoscore/schema';
import { pl } from '../i18n/pl';

// Pozycja meczu w rundzie z końcówki id (p-sf-2 to 2). Finał i mecz o 3. miejsce są jedyne w rundzie.
export function fixtureOrdinal(id: string): number {
  const match = /-(\d+)$/.exec(id);
  return match ? Number(match[1]) : 1;
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Te same teksty co etykiety meczów na serwerze.
export function fixtureLabel(format: TournamentFormat, fixture: Fixture): string {
  if (fixture.phase === 'third_place') {
    return pl.phaseThirdPlace;
  }
  if (fixture.phase === 'group' || fixture.bracketRound === null) {
    return format === 'league' ? pl.leagueFixture(fixture.number) : pl.groupFixture(fixture.number);
  }
  const ordinal = fixtureOrdinal(fixture.id);
  if (fixture.phase === 'consolation') {
    return fixture.bracketRound === 'final'
      ? pl.phaseConsolation
      : pl.consolationFixture(lowerFirst(pl.roundFixture[fixture.bracketRound]), ordinal);
  }
  return fixture.bracketRound === 'final' ? pl.phaseFinal : pl.bracketFixture(pl.roundFixture[fixture.bracketRound], ordinal);
}
