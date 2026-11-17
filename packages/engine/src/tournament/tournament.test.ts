import { Fixture, StandingRow, TournamentConfig } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { computeTournament, EngineError, type FixtureFact, type FixtureScoring, type TournamentInput } from '../index.js';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function league(playerIds: readonly string[], group = 3): TournamentConfig {
  return TournamentConfig.parse({ name: 'Liga', format: 'league', playerIds, legsToWin: { group } });
}

// Bez parsowania, bo TournamentConfig.parse odrzuca złą liczbę graczy, a silnik ma ją odrzucić sam.
function rawLeague(playerIds: readonly string[]): TournamentConfig {
  return { ...league(['a', 'b', 'c']), playerIds: [...playerIds] };
}

function fact(
  fixtureId: string,
  legs: readonly [number, number],
  scoring: readonly [FixtureScoring, FixtureScoring] | null = null,
  matchId = `m-${fixtureId}`,
): FixtureFact {
  return { fixtureId, matchId, legs, scoring };
}

const score = (points: number, darts: number): FixtureScoring => ({ points, darts });

// Każdy wynik przechodzi przez kontrakt.
function compute(input: TournamentInput) {
  const state = computeTournament(input);
  for (const fixture of state.fixtures) {
    expect(Fixture.parse(fixture)).toEqual(fixture);
  }
  for (const row of state.standings) {
    expect(StandingRow.parse(row)).toEqual(row);
  }
  return state;
}

function expectEngineError(fn: () => unknown, code: EngineError['code']) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).code).toBe(code);
    return;
  }
  throw new Error(`Expected EngineError ${code}`);
}

const SIX = IDS.slice(0, 6);

// Grupa z makiety: pierwsze trzy rundy rozegrane.
const REFERENCE_FACTS: readonly FixtureFact[] = [
  fact('g-1', [3, 2]),
  fact('g-2', [3, 0]),
  fact('g-3', [3, 2]),
  fact('g-4', [3, 2]),
  fact('g-5', [3, 0]),
  fact('g-6', [3, 0]),
  fact('g-7', [3, 0]),
  fact('g-8', [3, 1]),
  fact('g-9', [3, 2]),
];

describe('computeTournament fixtures', () => {
  it.each([3, 4, 5, 6, 7, 8, 9, 10])('numbers %i players fixtures 1..k as g-<number>', (n) => {
    const { fixtures } = compute({ config: league(IDS.slice(0, n)), order: IDS.slice(0, n), matches: [] });
    expect(fixtures).toHaveLength((n * (n - 1)) / 2);
    expect(fixtures.map((fixture) => fixture.number)).toEqual(fixtures.map((_, index) => index + 1));
    expect(fixtures.map((fixture) => fixture.id)).toEqual(fixtures.map((_, index) => `g-${index + 1}`));
  });

  it('builds group fixtures in play order with the round and slots from the schedule', () => {
    const { fixtures } = compute({ config: league(SIX, 5), order: SIX, matches: [] });
    expect(fixtures[0]).toEqual({
      id: 'g-1',
      number: 1,
      phase: 'group',
      round: 1,
      bracketRound: null,
      board: 1,
      legsToWin: 5,
      slots: [
        { kind: 'player', playerId: 'a', seed: null },
        { kind: 'player', playerId: 'f', seed: null },
      ],
      status: 'ready',
      matchId: null,
      result: null,
      averages: null,
    });
    expect(fixtures.map((fixture) => fixture.round)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
    expect(fixtures.map((fixture) => fixture.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : '')).join('-'))).toEqual([
      'a-f',
      'b-e',
      'c-d',
      'a-e',
      'b-d',
      'c-f',
      'a-d',
      'b-c',
      'e-f',
      'a-c',
      'b-f',
      'd-e',
      'a-b',
      'c-e',
      'd-f',
    ]);
  });

  it('builds the schedule from the drawn order, not the entry order', () => {
    const { fixtures } = compute({ config: league(['a', 'b', 'c']), order: ['c', 'a', 'b'], matches: [] });
    expect(fixtures.map((fixture) => fixture.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : '')))).toEqual([
      ['a', 'b'],
      ['c', 'b'],
      ['c', 'a'],
    ]);
  });
});

describe('computeTournament reference table', () => {
  it('ranks the mockup group after three rounds', () => {
    const state = compute({ config: league(SIX), order: SIX, matches: REFERENCE_FACTS });
    expect(
      state.standings.map((row) => [
        row.place,
        row.playerId,
        row.played,
        row.won,
        row.lost,
        row.legsFor,
        row.legsAgainst,
        row.legDifference,
        row.points,
      ]),
    ).toEqual([
      [1, 'b', 3, 3, 0, 9, 1, 8, 6],
      [2, 'a', 3, 3, 0, 9, 4, 5, 6],
      [3, 'c', 3, 2, 1, 7, 5, 2, 4],
      [4, 'e', 3, 1, 2, 5, 8, -3, 2],
      [5, 'f', 3, 0, 3, 4, 9, -5, 0],
      [6, 'd', 3, 0, 3, 2, 9, -7, 0],
    ]);
    expect(state.standings.every((row) => row.average === null)).toBe(true);
    expect(state.nextFixtureId).toBe('g-10');
    expect(state.fixtures.slice(9).every((fixture) => fixture.status === 'ready')).toBe(true);
    expect(state.status).toBe('in_progress');
    expect(state.placements).toEqual([]);
    expect(state.canRedraw).toBe(false);
    expect(state.liveFixtureId).toBeNull();
  });

  it('marks a played fixture finished with its result and match id', () => {
    const { fixtures } = compute({ config: league(SIX), order: SIX, matches: REFERENCE_FACTS });
    expect(fixtures[5]).toMatchObject({
      id: 'g-6',
      status: 'finished',
      matchId: 'm-g-6',
      result: { legs: [3, 0], winnerId: 'c', corrected: false },
      averages: null,
    });
    expect(fixtures[0]?.result?.winnerId).toBe('a');
  });

  it('gives the win to the second slot when it reaches legsToWin', () => {
    const { fixtures, standings } = compute({ config: league(['a', 'b', 'c']), order: ['a', 'b', 'c'], matches: [fact('g-1', [1, 3])] });
    expect(fixtures[0]?.result).toEqual({ legs: [1, 3], winnerId: 'c', corrected: false });
    expect(standings[0]?.playerId).toBe('c');
  });
});

describe('computeTournament league progress', () => {
  it('has one live fixture with its match id while it is in progress', () => {
    const state = compute({ config: league(SIX), order: SIX, matches: [fact('g-1', [1, 0])] });
    expect(state.liveFixtureId).toBe('g-1');
    expect(state.fixtures[0]).toMatchObject({ status: 'in_progress', matchId: 'm-g-1', result: null, averages: null });
    expect(state.nextFixtureId).toBe('g-2');
    expect(state.status).toBe('in_progress');
    expect(state.standings.every((row) => row.played === 0)).toBe(true);
  });

  it('picks the most recently started fixture as live when two are in progress', () => {
    const state = compute({
      config: league(SIX),
      order: SIX,
      matches: [fact('g-3', [0, 0]), fact('g-1', [2, 2]), fact('g-2', [3, 1])],
    });
    expect(state.liveFixtureId).toBe('g-1');
    expect(state.fixtures.filter((fixture) => fixture.status === 'in_progress').map((fixture) => fixture.id)).toEqual(['g-1', 'g-3']);
    expect(state.nextFixtureId).toBe('g-4');
  });

  it('offers the lowest numbered ready fixture even when a later one was played first', () => {
    const state = compute({ config: league(SIX), order: SIX, matches: [fact('g-2', [3, 1])] });
    expect(state.nextFixtureId).toBe('g-1');
  });

  it('finishes the league and gives placements from the table', () => {
    const state = compute({
      config: league(['a', 'b', 'c']),
      order: ['a', 'b', 'c'],
      matches: [fact('g-1', [3, 0]), fact('g-2', [3, 1]), fact('g-3', [3, 2])],
    });
    expect(state.status).toBe('finished');
    expect(state.nextFixtureId).toBeNull();
    expect(state.liveFixtureId).toBeNull();
    expect(state.placements).toEqual([
      { playerId: 'a', place: 1 },
      { playerId: 'b', place: 2 },
      { playerId: 'c', place: 3 },
    ]);
    expect(state.placements).toEqual(state.standings.map((row) => ({ playerId: row.playerId, place: row.place })));
  });

  it('allows a redraw only before the first started match', () => {
    expect(compute({ config: league(SIX), order: SIX, matches: [] }).canRedraw).toBe(true);
    expect(compute({ config: league(SIX), order: SIX, matches: [fact('g-1', [0, 0])] }).canRedraw).toBe(false);
  });
});

describe('computeTournament averages', () => {
  it('gives fixture averages and a weighted row average from scoring', () => {
    const state = compute({
      config: league(['a', 'b', 'c']),
      order: ['a', 'b', 'c'],
      // g-1 to b-c, g-2 a-c, g-3 a-b.
      matches: [fact('g-2', [3, 1], [score(300, 9), score(100, 7)]), fact('g-3', [3, 0], [score(150, 15), score(40, 30)])],
    });
    expect(state.fixtures[1]?.averages).toEqual([100, 42.86]);
    expect(state.fixtures[2]?.averages).toEqual([30, 4]);
    // 3 * 450 / 24, a nie średnia ze 100 i 30.
    expect(state.standings.find((row) => row.playerId === 'a')?.average).toBe(56.25);
  });

  it('has no fixture averages without scoring, with 0 darts on a side, or before the end', () => {
    const state = compute({
      config: league(['a', 'b', 'c']),
      order: ['a', 'b', 'c'],
      matches: [fact('g-1', [3, 1]), fact('g-2', [3, 1], [score(90, 9), score(0, 0)]), fact('g-3', [2, 1], [score(90, 9), score(60, 9)])],
    });
    expect(state.fixtures.map((fixture) => fixture.averages)).toEqual([null, null, null]);
    expect(state.standings.find((row) => row.playerId === 'a')?.average).toBe(30);
  });
});

describe('computeTournament rejects', () => {
  const base = { config: league(['a', 'b', 'c', 'd']), order: ['a', 'b', 'c', 'd'] };
  const reject = (input: TournamentInput) => expectEngineError(() => computeTournament(input), 'invalid_config');

  it('a cup', () => {
    reject({ ...base, config: TournamentConfig.parse({ name: 'Puchar', format: 'cup', playerIds: base.order }), matches: [] });
  });

  it('a group and play-off', () => {
    reject({
      ...base,
      config: TournamentConfig.parse({ name: 'Grupa', format: 'group_playoff', playerIds: base.order, advance: 2 }),
      matches: [],
    });
  });

  it('2 players', () => {
    reject({ config: rawLeague(['a', 'b']), order: ['a', 'b'], matches: [] });
  });

  it('11 players', () => {
    const ids = [...IDS, 'k'];
    reject({ config: rawLeague(ids), order: ids, matches: [] });
  });

  it.each([
    ['a missing player', ['a', 'b', 'c']],
    ['an extra player', ['a', 'b', 'c', 'd', 'e']],
    ['a stranger', ['a', 'b', 'c', 'x']],
    ['a duplicate', ['a', 'b', 'c', 'c']],
  ])('an order with %s', (_, order) => {
    reject({ ...base, order, matches: [] });
  });

  it('an unknown fixture id', () => {
    reject({ ...base, matches: [fact('g-7', [0, 0])] });
  });

  it('a duplicate fixture id', () => {
    reject({ ...base, matches: [fact('g-1', [0, 0], null, 'm-1'), fact('g-1', [1, 0], null, 'm-2')] });
  });

  it('a duplicate match id', () => {
    reject({ ...base, matches: [fact('g-1', [0, 0], null, 'm-1'), fact('g-2', [1, 0], null, 'm-1')] });
  });

  it('an empty match id', () => {
    reject({ ...base, matches: [fact('g-1', [0, 0], null, '')] });
  });

  it.each([
    ['above legsToWin', [4, 0]],
    ['both at legsToWin', [3, 3]],
    ['negative', [-1, 0]],
    ['not integers', [1.5, 0]],
  ] as const)('legs %s', (_, legs) => {
    reject({ ...base, matches: [fact('g-1', legs)] });
  });

  it.each([
    ['negative points', score(-1, 9)],
    ['negative darts', score(60, -3)],
    ['fractional darts', score(60, 1.5)],
  ])('scoring with %s', (_, side) => {
    reject({ ...base, matches: [fact('g-1', [3, 0], [score(60, 9), side])] });
  });
});
