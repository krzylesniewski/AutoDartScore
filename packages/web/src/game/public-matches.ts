import type { Fixture, PublicTournamentView } from '@autoscore/schema';

// Mecze z rozegranym albo trwającym meczem, od ostatniego. Walkower nie ma czego pokazać, więc go tu nie ma.
export function publicMatchFixtures(view: Pick<PublicTournamentView, 'fixtures'>): Fixture[] {
  return view.fixtures
    .filter((fixture) => fixture.matchId !== null && (fixture.status === 'finished' || fixture.status === 'in_progress'))
    .sort((first, second) => second.number - first.number);
}
