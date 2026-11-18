import type { Fixture, PublicTournamentView } from '@autoscore/schema';

export type ProgressPhase = 'league' | 'group' | 'playoff' | 'finished';

export interface TournamentProgress {
  readonly phase: ProgressPhase;
  readonly done: number;
  readonly total: number;
}

function hasResult(fixture: Fixture): boolean {
  return fixture.status === 'finished' || fixture.status === 'walkover';
}

function count(phase: ProgressPhase, fixtures: readonly Fixture[]): TournamentProgress {
  return { phase, done: fixtures.filter(hasResult).length, total: fixtures.length };
}

// Wolny los nie jest meczem do rozegrania, więc nie wchodzi do sumy.
export function tournamentProgress(view: PublicTournamentView): TournamentProgress {
  const played = view.fixtures.filter((fixture) => fixture.status !== 'bye');
  if (view.status === 'finished') {
    return count('finished', played);
  }
  if (view.format === 'league') {
    return count('league', view.fixtures);
  }
  const group = view.fixtures.filter((fixture) => fixture.phase === 'group');
  if (view.format === 'group_playoff' && group.some((fixture) => !hasResult(fixture))) {
    return count('group', group);
  }
  return count(
    'playoff',
    played.filter((fixture) => fixture.phase !== 'group'),
  );
}
