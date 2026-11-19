import type { Fixture, FixtureStatus, TournamentPlayer, TournamentView } from '@autoscore/schema';

export type CorrectionImpact = 'league' | 'group' | 'bracket';

const OPEN_STATUSES: readonly FixtureStatus[] = ['waiting', 'ready', 'in_progress'];

function hasPlayer(fixture: Fixture, playerId: string): boolean {
  return fixture.slots.some((slot) => slot.kind === 'player' && slot.playerId === playerId);
}

// Puchar nie ma tabeli, więc wycofanie widać tam tylko po przegranych walkowerach.
export function withdrawnPlayerIds(view: TournamentView): Set<string> {
  const ids = new Set(view.standings.filter((row) => row.withdrawn).map((row) => row.playerId));
  for (const fixture of view.fixtures) {
    if (fixture.status !== 'walkover' || fixture.result === null) {
      continue;
    }
    for (const slot of fixture.slots) {
      if (slot.kind === 'player' && slot.playerId !== fixture.result.winnerId) {
        ids.add(slot.playerId);
      }
    }
  }
  return ids;
}

// Każdy z tych meczów gracz przegra walkowerem po wycofaniu, a trwający zostanie porzucony.
export function openFixturesOf(view: TournamentView, playerId: string): Fixture[] {
  return view.fixtures.filter((fixture) => OPEN_STATUSES.includes(fixture.status) && hasPlayer(fixture, playerId));
}

// Wycofanie odpadłego gracza pucharu niczego nie zmienia i nie dałoby się go potem pokazać.
export function withdrawCandidates(view: TournamentView): TournamentPlayer[] {
  const withdrawn = withdrawnPlayerIds(view);
  return view.players.filter(
    (player) => !withdrawn.has(player.id) && (view.format !== 'cup' || openFixturesOf(view, player.id).length > 0),
  );
}

export function correctableFixtures(view: TournamentView): Fixture[] {
  return view.fixtures.filter((fixture) => fixture.status === 'finished').sort((first, second) => first.number - second.number);
}

export function isValidCorrection(legs: readonly [number, number], legsToWin: number): boolean {
  const [first, second] = legs;
  if (first < 0 || second < 0) {
    return false;
  }
  return (first === legsToWin && second < legsToWin) || (second === legsToWin && first < legsToWin);
}

export function correctionImpact(view: TournamentView, fixture: Fixture): CorrectionImpact {
  if (fixture.phase === 'group') {
    return view.format === 'league' ? 'league' : 'group';
  }
  return 'bracket';
}
