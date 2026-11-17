import {
  TOURNAMENT_PLAYER_LIMITS,
  type BracketRound,
  type Fixture,
  type FixturePhase,
  type FixtureSlot,
  type FixtureStatus,
  type StandingRow,
  type TournamentConfig,
  type TournamentPlacement,
  type TournamentStatus,
} from '@autoscore/schema';
import { EngineError } from '../errors.js';
import { buildBracket, type BracketNode } from './bracket.js';
import { bracketPlacements, outcome, type PlayerSlot } from './placements.js';
import { roundRobinRounds } from './round-robin.js';
import { computeStandings, threeDartAverage, type FinishedFixture } from './standings.js';

// Turniej: stan zawsze liczony od nowa z konfiguracji, ostatniego losowania i faktów o rozpoczętych meczach.
// Liga (każdy z każdym), puchar (drabinka z losowania) albo grupa z play-off.

export interface FixtureScoring {
  readonly points: number; // punkty z zamkniętych tur, bust liczy się jako 0
  readonly darts: number; // rzutki z zamkniętych tur
}

export interface FixtureFact {
  readonly fixtureId: string;
  readonly matchId: string;
  readonly legs: readonly [number, number]; // wygrane legi w kolejności slotów
  readonly scoring: readonly [FixtureScoring, FixtureScoring] | null; // null, dopóki serwer nie liczy średnich
}

export interface TournamentInput {
  readonly config: TournamentConfig;
  readonly order: readonly string[]; // ostatnie losowanie z logu
  readonly matches: readonly FixtureFact[]; // jeden na rozpoczęty mecz, w kolejności fixture_started
}

export interface TournamentState {
  readonly status: TournamentStatus;
  readonly fixtures: readonly Fixture[];
  readonly standings: readonly StandingRow[];
  readonly nextFixtureId: string | null;
  readonly liveFixtureId: string | null;
  readonly placements: readonly TournamentPlacement[];
  readonly canRedraw: boolean;
}

const ADVANCE_VALUES: readonly number[] = [2, 4, 8];

// seed to rozstawienie w drabince. Na gracza albo miejsce w tabeli zamienia się dopiero po policzeniu grupy.
type PlanSlot = FixtureSlot | { readonly kind: 'seed'; readonly seed: number };

interface Plan<Slot = PlanSlot> {
  readonly id: string;
  readonly phase: FixturePhase;
  readonly round: number;
  readonly bracketRound: BracketRound | null;
  readonly legsToWin: number;
  readonly slots: readonly [Slot, Slot];
}

interface Layout {
  readonly group: readonly Plan<FixtureSlot>[];
  readonly playoff: readonly (readonly Plan[])[]; // rundy, ostatnia to finał
  readonly thirdPlace: readonly Plan[];
  readonly consolation: readonly (readonly Plan[])[];
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validateConfig({ config, order }: TournamentInput): void {
  const { min, max } = TOURNAMENT_PLAYER_LIMITS[config.format];
  if (config.playerIds.length < min || config.playerIds.length > max) {
    throw new EngineError('invalid_config', `Format ${config.format} needs ${min} to ${max} players`);
  }
  if (config.format === 'group_playoff') {
    const { advance } = config;
    if (advance === undefined || !ADVANCE_VALUES.includes(advance) || advance > config.playerIds.length) {
      throw new EngineError('invalid_config', 'Group and play-off needs advance 2, 4 or 8, at most the number of players');
    }
  }
  const players = new Set(config.playerIds);
  if (order.length !== config.playerIds.length || new Set(order).size !== order.length || order.some((id) => !players.has(id))) {
    throw new EngineError('invalid_config', 'The drawn order must be a permutation of the player ids');
  }
}

function validateFacts(matches: readonly FixtureFact[], fixtureIds: ReadonlySet<string>): void {
  const seenFixtures = new Set<string>();
  const seenMatches = new Set<string>();
  for (const fact of matches) {
    if (!fixtureIds.has(fact.fixtureId)) {
      throw new EngineError('invalid_config', `Unknown fixture ${fact.fixtureId}`);
    }
    if (seenFixtures.has(fact.fixtureId)) {
      throw new EngineError('invalid_config', `Fixture ${fact.fixtureId} was started twice`);
    }
    if (!fact.matchId || seenMatches.has(fact.matchId)) {
      throw new EngineError('invalid_config', `Match id ${fact.matchId} must be non-empty and used once`);
    }
    seenFixtures.add(fact.fixtureId);
    seenMatches.add(fact.matchId);
    if (fact.scoring?.some((side) => !isCount(side.points) || !isCount(side.darts))) {
      throw new EngineError('invalid_config', `Scoring of fixture ${fact.fixtureId} must be non-negative integers`);
    }
  }
}

function validateLegs(fact: FixtureFact, legsToWin: number): void {
  if (fact.legs.some((legs) => !isCount(legs) || legs > legsToWin) || fact.legs.every((legs) => legs === legsToWin)) {
    throw new EngineError('invalid_config', `Legs of fixture ${fact.fixtureId} must be 0 to ${legsToWin} with at most one winner`);
  }
}

function fixtureAverages(fact: FixtureFact): [number, number] | null {
  if (!fact.scoring) {
    return null;
  }
  const first = threeDartAverage(fact.scoring[0].points, fact.scoring[0].darts);
  const second = threeDartAverage(fact.scoring[1].points, fact.scoring[1].darts);
  return first === null || second === null ? null : [first, second];
}

function hasBye(slots: readonly PlanSlot[]): boolean {
  return slots.some((slot) => slot.kind === 'bye');
}

function isBye(plan: Plan): boolean {
  return hasBye(plan.slots);
}

function planSlot(source: BracketNode['sources'][number], seedOffset: number): PlanSlot {
  return source.kind === 'seed' ? { kind: 'seed', seed: source.seed + seedOffset } : source;
}

function bracketPlans(
  rounds: readonly (readonly BracketNode[])[],
  phase: FixturePhase,
  legsToWin: (round: BracketRound) => number,
  seedOffset: number,
): Plan[][] {
  return rounds.map((round) =>
    round.map((node): Plan => ({
      id: node.id,
      phase,
      round: node.round,
      bracketRound: node.bracketRound,
      legsToWin: legsToWin(node.bracketRound),
      slots: [planSlot(node.sources[0], seedOffset), planSlot(node.sources[1], seedOffset)],
    })),
  );
}

function thirdPlacePlans(config: TournamentConfig, playoff: readonly (readonly Plan[])[]): Plan[] {
  const semifinals = playoff.flat().filter((plan) => plan.bracketRound === 'sf');
  // Puchar dla 3 graczy ma tylko jednego przegranego półfinału, bo drugi półfinał to wolny los.
  if (!config.thirdPlaceMatch || semifinals.length !== 2 || semifinals.some(isBye)) {
    return [];
  }
  return [
    {
      id: 'p-3rd',
      phase: 'third_place',
      round: 1,
      bracketRound: null,
      legsToWin: config.legsToWin.thirdPlace,
      slots: [
        { kind: 'loser_of', fixtureId: 'p-sf-1' },
        { kind: 'loser_of', fixtureId: 'p-sf-2' },
      ],
    },
  ];
}

function layout(config: TournamentConfig, order: readonly string[]): Layout {
  const rounds = config.format === 'cup' ? [] : roundRobinRounds(order);
  const pairs = rounds.flatMap((round, index) => round.map((pair) => ({ pair, round: index + 1 })));
  const group = pairs.map(({ pair, round }, index): Plan<FixtureSlot> => ({
    id: `g-${index + 1}`,
    phase: 'group',
    round,
    bracketRound: null,
    legsToWin: config.legsToWin.group,
    slots: [
      { kind: 'player', playerId: pair[0], seed: null },
      { kind: 'player', playerId: pair[1], seed: null },
    ],
  }));
  if (config.format === 'league') {
    return { group, playoff: [], thirdPlace: [], consolation: [] };
  }
  const entrants = config.format === 'cup' ? config.playerIds.length : (config.advance as number);
  const playoff = bracketPlans(buildBracket('p', entrants), 'playoff', (round) => config.legsToWin[round], 0);
  const outside = config.playerIds.length - entrants;
  const consolation =
    config.format === 'group_playoff' && config.consolation && outside >= 2
      ? bracketPlans(buildBracket('c', outside), 'consolation', () => config.legsToWin.consolation, entrants)
      : [];
  return { group, playoff, thirdPlace: thirdPlacePlans(config, playoff), consolation };
}

// Kolejność gry: grupa, rundy play-off przed finałem, pocieszenie, mecz o 3. miejsce, finał. Wolne losy to nie mecze, idą na koniec.
function playOrder({ group, playoff, thirdPlace, consolation }: Layout): Plan[] {
  const bracket = [...playoff.slice(0, -1).flat(), ...consolation.flat(), ...thirdPlace, ...(playoff.at(-1) ?? [])];
  return [...group, ...bracket.filter((plan) => !isBye(plan)), ...bracket.filter(isBye)];
}

function resolveSlot(slot: PlanSlot, entry: (seed: number) => FixtureSlot, resolved: ReadonlyMap<string, Fixture>): FixtureSlot {
  if (slot.kind === 'seed') {
    return entry(slot.seed);
  }
  if (slot.kind !== 'winner_of' && slot.kind !== 'loser_of') {
    return slot;
  }
  const feeder = resolved.get(slot.fixtureId) as Fixture;
  // Wolny los przekazuje dalej drugi slot taki, jaki jest: gracza albo miejsce w tabeli trwającej grupy.
  if (feeder.status === 'bye') {
    return feeder.slots.find((candidate) => candidate.kind !== 'bye') as FixtureSlot;
  }
  const sides = outcome(feeder);
  if (!sides) {
    return slot;
  }
  return slot.kind === 'winner_of' ? sides.winner : sides.loser;
}

function playFixture(plan: Omit<Plan, 'slots'>, number: number, slots: [FixtureSlot, FixtureSlot], fact: FixtureFact | undefined): Fixture {
  const { id, phase, round, bracketRound, legsToWin } = plan;
  const base: Omit<Fixture, 'status' | 'matchId' | 'result' | 'averages'> = {
    id,
    number,
    phase,
    round,
    bracketRound,
    board: 1,
    legsToWin,
    slots,
  };
  const status: FixtureStatus = hasBye(slots) ? 'bye' : slots.every((slot) => slot.kind === 'player') ? 'ready' : 'waiting';
  if (!fact) {
    return { ...base, status, matchId: null, result: null, averages: null };
  }
  if (status !== 'ready') {
    throw new EngineError('invalid_config', `Fixture ${id} is ${status} and cannot be started`);
  }
  validateLegs(fact, legsToWin);
  const winner = fact.legs.indexOf(legsToWin);
  if (winner === -1) {
    return { ...base, status: 'in_progress', matchId: fact.matchId, result: null, averages: null };
  }
  return {
    ...base,
    status: 'finished',
    matchId: fact.matchId,
    result: { legs: [fact.legs[0], fact.legs[1]], winnerId: (slots[winner === 0 ? 0 : 1] as PlayerSlot).playerId, corrected: false },
    averages: fixtureAverages(fact),
  };
}

export function computeTournament(input: TournamentInput): TournamentState {
  validateConfig(input);
  const { config, order, matches } = input;
  const plans = layout(config, order);
  const numbers = new Map(playOrder(plans).map((plan, index) => [plan.id, index + 1]));
  validateFacts(matches, new Set(numbers.keys()));

  const facts = new Map(matches.map((fact) => [fact.fixtureId, fact]));
  const resolved = new Map<string, Fixture>();
  const play = (plan: Omit<Plan, 'slots'>, slots: [FixtureSlot, FixtureSlot]): Fixture => {
    const fixture = playFixture(plan, numbers.get(plan.id) as number, slots, facts.get(plan.id));
    resolved.set(plan.id, fixture);
    return fixture;
  };

  const finished: FinishedFixture[] = [];
  let groupDone = true;
  for (const plan of plans.group) {
    const fixture = play(plan, [plan.slots[0], plan.slots[1]]);
    const fact = facts.get(plan.id);
    if (fixture.status !== 'finished' || !fact) {
      groupDone = false;
      continue;
    }
    const [first, second] = fixture.slots as readonly [PlayerSlot, PlayerSlot];
    finished.push({ playerIds: [first.playerId, second.playerId], legs: fact.legs, scoring: fact.scoring });
  }
  const advance = config.advance ?? 0;
  const standings =
    config.format === 'cup'
      ? []
      : computeStandings(config.playerIds, order, finished).map((row) =>
          config.format === 'group_playoff' ? { ...row, advances: row.place <= advance } : row,
        );

  // Puchar rozstawia według losowania, grupa z play-off według miejsca w tabeli, znanego dopiero po grupie.
  const entry = (seed: number): FixtureSlot => {
    if (config.format === 'cup') {
      return { kind: 'player', playerId: order[seed - 1] as string, seed };
    }
    return groupDone
      ? { kind: 'player', playerId: (standings[seed - 1] as StandingRow).playerId, seed }
      : { kind: 'standing', place: seed };
  };
  for (const plan of [...plans.playoff.flat(), ...plans.thirdPlace, ...plans.consolation.flat()]) {
    play(plan, [resolveSlot(plan.slots[0], entry, resolved), resolveSlot(plan.slots[1], entry, resolved)]);
  }

  const fixtures = [...resolved.values()].sort((a, b) => a.number - b.number);
  const done = fixtures.every((fixture) => fixture.status === 'finished' || fixture.status === 'bye');
  const live = matches.filter((fact) => fixtures.some((fixture) => fixture.id === fact.fixtureId && fixture.status === 'in_progress'));
  let placements: TournamentPlacement[] = [];
  if (config.format !== 'league') {
    placements = bracketPlacements({ format: config.format, fixtures, standings, groupDone, advance });
  } else if (done) {
    placements = standings.map((row) => ({ playerId: row.playerId, place: row.place }));
  }
  return {
    status: done ? 'finished' : 'in_progress',
    fixtures,
    standings,
    nextFixtureId: fixtures.find((fixture) => fixture.status === 'ready')?.id ?? null,
    liveFixtureId: live.at(-1)?.fixtureId ?? null,
    placements,
    canRedraw: matches.length === 0,
  };
}
