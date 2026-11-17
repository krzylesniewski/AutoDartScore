import {
  TOURNAMENT_PLAYER_LIMITS,
  type Fixture,
  type StandingRow,
  type TournamentConfig,
  type TournamentPlacement,
  type TournamentStatus,
} from '@autoscore/schema';
import { EngineError } from '../errors.js';
import { roundRobinRounds } from './round-robin.js';
import { computeStandings, threeDartAverage, type FinishedFixture } from './standings.js';

// Turniej: stan zawsze liczony od nowa z konfiguracji, ostatniego losowania i faktów o rozpoczętych meczach.
// Na razie tylko liga (każdy z każdym).

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

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validateConfig({ config, order }: TournamentInput): void {
  if (config.format !== 'league') {
    throw new EngineError('invalid_config', `Tournament format ${config.format} is not supported yet`);
  }
  const { min, max } = TOURNAMENT_PLAYER_LIMITS.league;
  if (config.playerIds.length < min || config.playerIds.length > max) {
    throw new EngineError('invalid_config', `A league needs ${min} to ${max} players`);
  }
  const players = new Set(config.playerIds);
  if (order.length !== config.playerIds.length || new Set(order).size !== order.length || order.some((id) => !players.has(id))) {
    throw new EngineError('invalid_config', 'The drawn order must be a permutation of the player ids');
  }
}

function validateFacts(matches: readonly FixtureFact[], fixtureIds: ReadonlySet<string>, legsToWin: number): void {
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
    if (fact.legs.some((legs) => !isCount(legs) || legs > legsToWin) || fact.legs.every((legs) => legs === legsToWin)) {
      throw new EngineError('invalid_config', `Legs of fixture ${fact.fixtureId} must be 0 to ${legsToWin} with at most one winner`);
    }
    if (fact.scoring?.some((side) => !isCount(side.points) || !isCount(side.darts))) {
      throw new EngineError('invalid_config', `Scoring of fixture ${fact.fixtureId} must be non-negative integers`);
    }
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

export function computeTournament(input: TournamentInput): TournamentState {
  validateConfig(input);
  const { config, order, matches } = input;
  const legsToWin = config.legsToWin.group;
  const pairs = roundRobinRounds(order).flatMap((round, index) => round.map((pair) => ({ pair, round: index + 1 })));
  const fixtureIds = new Set(pairs.map((_, index) => `g-${index + 1}`));
  validateFacts(matches, fixtureIds, legsToWin);

  const facts = new Map(matches.map((fact) => [fact.fixtureId, fact]));
  const finished: FinishedFixture[] = [];
  const fixtures = pairs.map(({ pair, round }, index): Fixture => {
    const number = index + 1;
    const id = `g-${number}`;
    const base: Omit<Fixture, 'status' | 'matchId' | 'result' | 'averages'> = {
      id,
      number,
      phase: 'group',
      round,
      bracketRound: null,
      board: 1,
      legsToWin,
      slots: [
        { kind: 'player', playerId: pair[0], seed: null },
        { kind: 'player', playerId: pair[1], seed: null },
      ],
    };
    const fact = facts.get(id);
    if (!fact) {
      return { ...base, status: 'ready', matchId: null, result: null, averages: null };
    }
    const winner = fact.legs.indexOf(legsToWin);
    if (winner === -1) {
      return { ...base, status: 'in_progress', matchId: fact.matchId, result: null, averages: null };
    }
    finished.push({ playerIds: pair, legs: fact.legs, scoring: fact.scoring });
    return {
      ...base,
      status: 'finished',
      matchId: fact.matchId,
      result: { legs: [fact.legs[0], fact.legs[1]], winnerId: pair[winner === 0 ? 0 : 1], corrected: false },
      averages: fixtureAverages(fact),
    };
  });

  const standings = computeStandings(config.playerIds, order, finished);
  const done = fixtures.every((fixture) => fixture.status === 'finished');
  const live = matches.filter((fact) => fixtures.some((fixture) => fixture.id === fact.fixtureId && fixture.status === 'in_progress'));
  return {
    status: done ? 'finished' : 'in_progress',
    fixtures,
    standings,
    nextFixtureId: fixtures.find((fixture) => fixture.status === 'ready')?.id ?? null,
    liveFixtureId: live.at(-1)?.fixtureId ?? null,
    placements: done ? standings.map((row) => ({ playerId: row.playerId, place: row.place })) : [],
    canRedraw: matches.length === 0,
  };
}
