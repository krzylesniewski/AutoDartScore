import type { Fixture, PublicTournamentView } from '@autoscore/schema';

// Gdy nic nie jest gotowe, np. w trakcie półfinału, pokazuje pierwszy mecz czekający na wynik w kolejności gry.
export function tvNextFixture(view: PublicTournamentView): Fixture | null {
  const next = view.fixtures.find((fixture) => fixture.id === view.nextFixtureId);
  if (next) {
    return next;
  }
  const waiting = view.fixtures.filter((fixture) => fixture.status === 'waiting').sort((first, second) => first.number - second.number);
  return waiting[0] ?? null;
}
