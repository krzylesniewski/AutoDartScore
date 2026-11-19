import type { Fixture, FixturePhase, FixtureSlot, StandingRow, TournamentPlacement } from '@autoscore/schema';

export type PlayerSlot = Extract<FixtureSlot, { kind: 'player' }>;

export interface Outcome {
  readonly winner: PlayerSlot;
  readonly loser: PlayerSlot;
}

// Wynik ma tylko rozegrany mecz, a ten ma graczy w obu slotach.
export function outcome(fixture: Fixture): Outcome | null {
  if (!fixture.result) {
    return null;
  }
  const [first, second] = fixture.slots as readonly [PlayerSlot, PlayerSlot];
  return first.playerId === fixture.result.winnerId ? { winner: first, loser: second } : { winner: second, loser: first };
}

export interface BracketPlacementInput {
  readonly format: 'cup' | 'group_playoff';
  readonly fixtures: readonly Fixture[];
  readonly standings: readonly StandingRow[];
  readonly groupDone: boolean;
  readonly advance: number; // w pucharze bez znaczenia
}

interface Placed {
  readonly playerId: string;
  readonly place: number;
  readonly seed: number; // w pucharze pozycja w losowaniu, w grupie z play-off miejsce w grupie
}

function decided(fixture: Fixture): boolean {
  return fixture.status === 'finished' || fixture.status === 'walkover' || fixture.status === 'bye';
}

function bracketRounds(fixtures: readonly Fixture[], phase: FixturePhase): Fixture[][] {
  const rounds: Fixture[][] = [];
  for (const fixture of fixtures.filter((candidate) => candidate.phase === phase)) {
    (rounds[fixture.round - 1] ??= []).push(fixture);
  }
  return rounds;
}

function placed(slot: PlayerSlot, place: number): Placed {
  return { playerId: slot.playerId, place, seed: slot.seed as number };
}

// Runda z jednym meczem rozdziela dwa miejsca od offset + 1. Przegrani wcześniejszej rundy dostają miejsca
// za graczami, którzy w niej przeszli dalej, ale dopiero gdy cała runda jest rozstrzygnięta.
function placeRound(round: readonly Fixture[], offset: number, shared: boolean): Placed[] {
  if (round.length === 1) {
    const final = outcome(round[0] as Fixture);
    return final ? [placed(final.winner, offset + 1), placed(final.loser, offset + 2)] : [];
  }
  if (!round.every(decided)) {
    return [];
  }
  const first = offset + round.length + 1;
  return round
    .flatMap((fixture) => outcome(fixture)?.loser ?? [])
    .sort((a, b) => (a.seed as number) - (b.seed as number))
    .map((loser, index) => placed(loser, shared ? first : first + index));
}

// Miejsca znane w danej chwili. Po końcu turnieju każdy gracz ma dokładnie jedno.
export function bracketPlacements({ format, fixtures, standings, groupDone, advance }: BracketPlacementInput): TournamentPlacement[] {
  const third = fixtures.filter((fixture) => fixture.phase === 'third_place');
  const result = bracketRounds(fixtures, 'playoff').flatMap((round) =>
    round.length === 2 && third.length === 1 ? placeRound(third, 2, false) : placeRound(round, 0, format === 'cup' || round.length === 2),
  );
  const consolation = bracketRounds(fixtures, 'consolation');
  result.push(...consolation.flatMap((round) => placeRound(round, advance, false)));
  if (format === 'group_playoff' && consolation.length === 0 && groupDone) {
    result.push(
      ...standings.filter((row) => row.place > advance).map((row) => ({ playerId: row.playerId, place: row.place, seed: row.place })),
    );
  }
  return result.sort((a, b) => a.place - b.place || a.seed - b.seed).map(({ playerId, place }) => ({ playerId, place }));
}
