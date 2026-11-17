import type { BracketRound, Fixture, TournamentView } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { fixtureOrdinal } from './fixture-label';

export interface BracketColumn {
  readonly round: number;
  readonly bracketRound: BracketRound;
  readonly legsToWin: number;
  readonly fixtures: Fixture[];
}

// Rundy od pierwszej do finału. W kolumnie kolejność z id, bo numery gry stawiają wolne losy na końcu.
export function bracketColumns(view: TournamentView, phase: 'playoff' | 'consolation'): BracketColumn[] {
  const rounds = new Map<number, Fixture[]>();
  for (const fixture of view.fixtures) {
    if (fixture.phase === phase && fixture.bracketRound !== null) {
      rounds.set(fixture.round, [...(rounds.get(fixture.round) ?? []), fixture]);
    }
  }
  return [...rounds.entries()]
    .sort(([first], [second]) => first - second)
    .map(([round, fixtures]) => {
      const sorted = fixtures.sort((first, second) => fixtureOrdinal(first.id) - fixtureOrdinal(second.id));
      const head = sorted[0] as Fixture;
      return { round, bracketRound: head.bracketRound as BracketRound, legsToWin: head.legsToWin, fixtures: sorted };
    });
}

// Na co czeka mecz: na pierwszy slot bez gracza.
function feederText(view: TournamentView, fixture: Fixture): string | null {
  for (const slot of fixture.slots) {
    if (slot.kind === 'standing') {
      return pl.tagAfterGroup;
    }
    if (slot.kind === 'winner_of' || slot.kind === 'loser_of') {
      const source = view.fixtures.find((candidate) => candidate.id === slot.fixtureId);
      return source?.bracketRound ? pl.roundLocative[source.bracketRound] : null;
    }
  }
  return null;
}

// Linia stanu pod meczem w drabince. legNumber to bieżący leg trwającego meczu, gdy jest znany.
export function fixtureTag(view: TournamentView, fixture: Fixture, legNumber: number | null): string {
  switch (fixture.status) {
    case 'finished':
      return pl.fixtureTag(fixture.number, pl.tagFinished);
    case 'walkover':
      return pl.fixtureTag(fixture.number, pl.tagWalkover);
    case 'in_progress':
      return pl.fixtureTag(fixture.number, legNumber === null ? pl.tagLive : pl.tagLiveLeg(legNumber));
    case 'ready':
      return pl.fixtureTag(fixture.number, pl.tagReady);
    case 'bye':
      return pl.tagBye;
    case 'waiting': {
      const feeder = feederText(view, fixture);
      return feeder === null ? pl.fixtureTagNumber(fixture.number) : pl.fixtureTag(fixture.number, pl.tagAfter(feeder));
    }
  }
}
