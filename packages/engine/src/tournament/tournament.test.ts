import { Fixture, StandingRow, TournamentConfig, TournamentPlacement, type FixtureSlot } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  computeTournament,
  EngineError,
  type FixtureFact,
  type FixtureScoring,
  type TournamentInput,
  type TournamentState,
} from '../index.js';

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
  for (const placement of state.placements) {
    expect(TournamentPlacement.parse(placement)).toEqual(placement);
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
const LETTERS = [...IDS, 'k', 'l', 'm', 'n', 'o', 'p', 'q'];

function cup(n: number, options: object = {}): TournamentConfig {
  return TournamentConfig.parse({ name: 'Puchar', format: 'cup', playerIds: LETTERS.slice(0, n), ...options });
}

function groupPlayoff(n: number, advance: number, options: object = {}): TournamentConfig {
  return TournamentConfig.parse({ name: 'Grupa', format: 'group_playoff', playerIds: LETTERS.slice(0, n), advance, ...options });
}

// Bez parsowania, żeby silnik sam odrzucił albo zignorował to, co odrzuca schemat.
function raw(config: TournamentConfig, overrides: object): TournamentConfig {
  return { ...config, ...overrides };
}

function slotLabel(slot: FixtureSlot): string {
  switch (slot.kind) {
    case 'player':
      return slot.seed === null ? slot.playerId : `${slot.playerId}#${slot.seed}`;
    case 'winner_of':
      return `W(${slot.fixtureId})`;
    case 'loser_of':
      return `L(${slot.fixtureId})`;
    case 'standing':
      return `@${slot.place}`;
    case 'bye':
      return 'bye';
  }
}

// Mecz jako "numer id status slot0 slot1", żeby drabinkę dało się porównać listą napisów.
function describeFixture(fixture: Fixture): string {
  return `${fixture.number} ${fixture.id} ${fixture.status} ${slotLabel(fixture.slots[0])} ${slotLabel(fixture.slots[1])}`;
}

function byId(state: TournamentState, id: string): Fixture {
  const fixture = state.fixtures.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`No fixture ${id}`);
  }
  return fixture;
}

function bracketFixtures(state: TournamentState): string[] {
  return state.fixtures.filter((fixture) => fixture.phase !== 'group').map(describeFixture);
}

function places(state: TournamentState): string[] {
  return state.placements.map((placement) => `${placement.place} ${placement.playerId}`);
}

// Wcześniejsza litera zawsze wygrywa, więc tabela grupy idzie alfabetycznie.
function stronger(fixture: Fixture): 0 | 1 {
  const [first, second] = fixture.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : ''));
  return (first as string) < (second as string) ? 0 : 1;
}

// Gra kolejne gotowe mecze o najniższym numerze, aż nie ma gotowych albo stop zwróci true.
function playOut(input: TournamentInput, stop: (state: TournamentState) => boolean = () => false) {
  const matches = [...input.matches];
  let state = compute({ ...input, matches });
  while (state.nextFixtureId !== null && !stop(state)) {
    const fixture = byId(state, state.nextFixtureId);
    matches.push(fact(fixture.id, stronger(fixture) === 0 ? [fixture.legsToWin, 0] : [0, fixture.legsToWin]));
    state = compute({ ...input, matches });
  }
  return { state, matches };
}

const groupDone = (state: TournamentState) => state.fixtures.every((fixture) => fixture.phase !== 'group' || fixture.status === 'finished');

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

  it('a group and play-off without advance', () => {
    reject({ ...base, config: raw(groupPlayoff(4, 2), { advance: undefined }), matches: [] });
  });

  it.each([
    ['above the number of players', 8],
    ['outside 2, 4 and 8', 3],
  ])('a group and play-off with advance %s', (_, advance) => {
    reject({ ...base, config: raw(groupPlayoff(4, 2), { advance: advance as TournamentConfig['advance'] }), matches: [] });
  });

  it('17 players in a cup', () => {
    reject({ config: raw(cup(16), { playerIds: LETTERS }), order: LETTERS, matches: [] });
  });

  it('11 players in a group and play-off', () => {
    const ids = LETTERS.slice(0, 11);
    reject({ config: raw(groupPlayoff(10, 4), { playerIds: ids }), order: ids, matches: [] });
  });

  it('a fact on a waiting fixture', () => {
    reject({ config: cup(4), order: LETTERS.slice(0, 4), matches: [fact('p-f', [0, 0])] });
    reject({ config: groupPlayoff(6, 4), order: SIX, matches: [fact('p-sf-1', [0, 0])] });
  });

  it('a fact on a bye fixture', () => {
    reject({ config: cup(5), order: LETTERS.slice(0, 5), matches: [fact('p-qf-1', [0, 0])] });
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

describe('computeTournament cup', () => {
  it.each([
    [3, 4],
    [4, 4],
    [5, 8],
    [6, 8],
    [8, 8],
    [11, 16],
    [16, 16],
  ])('builds a cup of %i players in a bracket of %i with byes last', (n, size) => {
    const order = LETTERS.slice(0, n).reverse();
    const state = compute({ config: cup(n), order, matches: [] });
    const byes = state.fixtures.filter((fixture) => fixture.status === 'bye');
    const playable = state.fixtures.filter((fixture) => fixture.status !== 'bye');
    expect(playable).toHaveLength(n - 1);
    expect(byes).toHaveLength(size - n);
    expect(state.fixtures.map((fixture) => fixture.number)).toEqual(state.fixtures.map((_, index) => index + 1));
    expect(state.fixtures.slice(n - 1).every((fixture) => fixture.status === 'bye')).toBe(true);
    expect(state.fixtures.every((fixture) => fixture.phase === 'playoff' && fixture.board === 1)).toBe(true);
    expect(state.standings).toEqual([]);
    expect(state.placements).toEqual([]);
    for (const bye of byes) {
      expect(bye).toMatchObject({ round: 1, matchId: null, result: null, averages: null });
      expect(bye.slots[1]).toEqual({ kind: 'bye' });
      const player = slotLabel(bye.slots[0]);
      expect(state.fixtures.some((fixture) => fixture.round === 2 && fixture.slots.map(slotLabel).includes(player))).toBe(true);
    }
    for (const fixture of state.fixtures.filter((candidate) => candidate.round === 1)) {
      for (const slot of fixture.slots) {
        if (slot.kind === 'player') {
          expect(order[(slot.seed as number) - 1]).toBe(slot.playerId);
        }
      }
    }
    const { state: end } = playOut({ config: cup(n), order, matches: [] });
    expect(end.status).toBe('finished');
    expect(end.nextFixtureId).toBeNull();
    expect(new Set(end.placements.map((placement) => placement.playerId)).size).toBe(n);
    expect(end.placements).toHaveLength(n);
  });

  it('seeds a cup of 5 with byes for the top three, so seed 2 v seed 3 is ready at once', () => {
    const state = compute({ config: cup(5), order: LETTERS.slice(0, 5), matches: [] });
    expect(state.fixtures.map(describeFixture)).toEqual([
      '1 p-qf-2 ready d#4 e#5',
      '2 p-sf-1 waiting a#1 W(p-qf-2)',
      '3 p-sf-2 ready b#2 c#3',
      '4 p-f waiting W(p-sf-1) W(p-sf-2)',
      '5 p-qf-1 bye a#1 bye',
      '6 p-qf-3 bye b#2 bye',
      '7 p-qf-4 bye c#3 bye',
    ]);
    expect(state.fixtures.map((fixture) => [fixture.round, fixture.bracketRound])).toEqual([
      [1, 'qf'],
      [2, 'sf'],
      [2, 'sf'],
      [3, 'final'],
      [1, 'qf'],
      [1, 'qf'],
      [1, 'qf'],
    ]);
    expect(state.nextFixtureId).toBe('p-qf-2');
  });

  it('pairs a cup of 16 by standard seeding', () => {
    const state = compute({ config: cup(16), order: LETTERS.slice(0, 16), matches: [] });
    expect(state.fixtures.map(describeFixture)).toEqual([
      '1 p-r16-1 ready a#1 p#16',
      '2 p-r16-2 ready h#8 i#9',
      '3 p-r16-3 ready d#4 m#13',
      '4 p-r16-4 ready e#5 l#12',
      '5 p-r16-5 ready b#2 o#15',
      '6 p-r16-6 ready g#7 j#10',
      '7 p-r16-7 ready c#3 n#14',
      '8 p-r16-8 ready f#6 k#11',
      '9 p-qf-1 waiting W(p-r16-1) W(p-r16-2)',
      '10 p-qf-2 waiting W(p-r16-3) W(p-r16-4)',
      '11 p-qf-3 waiting W(p-r16-5) W(p-r16-6)',
      '12 p-qf-4 waiting W(p-r16-7) W(p-r16-8)',
      '13 p-sf-1 waiting W(p-qf-1) W(p-qf-2)',
      '14 p-sf-2 waiting W(p-qf-3) W(p-qf-4)',
      '15 p-f waiting W(p-sf-1) W(p-sf-2)',
    ]);
  });

  it('fills the next round slot with the winner and its seed, each slot on its own', () => {
    const state = compute({ config: cup(4), order: ['a', 'b', 'c', 'd'], matches: [fact('p-sf-2', [1, 3])] });
    expect(byId(state, 'p-f').slots).toEqual([
      { kind: 'winner_of', fixtureId: 'p-sf-1' },
      { kind: 'player', playerId: 'c', seed: 3 },
    ]);
    expect(byId(state, 'p-f').status).toBe('waiting');
  });

  it('tracks the live fixture and the redraw lock in a bracket', () => {
    const state = compute({ config: cup(4), order: ['a', 'b', 'c', 'd'], matches: [fact('p-sf-1', [1, 0])] });
    expect(state.liveFixtureId).toBe('p-sf-1');
    expect(state.nextFixtureId).toBe('p-sf-2');
    expect(state.canRedraw).toBe(false);
    expect(state.status).toBe('in_progress');
  });

  it('adds one third place match fed by the semifinal losers', () => {
    const config = cup(4, { thirdPlaceMatch: true });
    const state = compute({ config, order: ['a', 'b', 'c', 'd'], matches: [] });
    expect(state.fixtures.map(describeFixture)).toEqual([
      '1 p-sf-1 ready a#1 d#4',
      '2 p-sf-2 ready b#2 c#3',
      '3 p-3rd waiting L(p-sf-1) L(p-sf-2)',
      '4 p-f waiting W(p-sf-1) W(p-sf-2)',
    ]);
    expect(byId(state, 'p-3rd')).toMatchObject({ phase: 'third_place', round: 1, bracketRound: null, legsToWin: 2 });
    const after = compute({ config, order: ['a', 'b', 'c', 'd'], matches: [fact('p-sf-1', [3, 1]), fact('p-sf-2', [3, 0])] });
    expect(describeFixture(byId(after, 'p-3rd'))).toBe('3 p-3rd ready d#4 c#3');
    const eight = compute({ config: cup(8, { thirdPlaceMatch: true }), order: LETTERS.slice(0, 8), matches: [] });
    expect(eight.fixtures.map((fixture) => fixture.id).slice(-2)).toEqual(['p-3rd', 'p-f']);
    expect(eight.fixtures.filter((fixture) => fixture.phase === 'third_place')).toHaveLength(1);
  });

  it('has no third place match in a cup of 3, whose first semifinal is a bye', () => {
    const state = compute({ config: cup(3, { thirdPlaceMatch: true }), order: ['a', 'b', 'c'], matches: [] });
    expect(state.fixtures.map(describeFixture)).toEqual(['1 p-sf-2 ready b#2 c#3', '2 p-f waiting a#1 W(p-sf-2)', '3 p-sf-1 bye a#1 bye']);
  });

  it('takes the length of each fixture from its bracket round', () => {
    const legsToWin = { r16: 1, qf: 2, sf: 3, final: 4, thirdPlace: 5 };
    const state = compute({ config: cup(16, { thirdPlaceMatch: true, legsToWin }), order: LETTERS.slice(0, 16), matches: [] });
    expect(
      state.fixtures.map((fixture) => `${fixture.id}:${fixture.legsToWin}`).filter((_, index) => [0, 8, 12, 14, 15].includes(index)),
    ).toEqual(['p-r16-1:1', 'p-qf-1:2', 'p-sf-1:3', 'p-3rd:5', 'p-f:4']);
  });

  it('checks fact legs against the fixture length', () => {
    const config = cup(4, { legsToWin: { sf: 1, final: 2 } });
    const order = ['a', 'b', 'c', 'd'];
    expect(byId(compute({ config, order, matches: [fact('p-sf-1', [0, 1])] }), 'p-sf-1').result).toEqual({
      legs: [0, 1],
      winnerId: 'd',
      corrected: false,
    });
    expectEngineError(() => computeTournament({ config, order, matches: [fact('p-sf-1', [2, 0])] }), 'invalid_config');
    const finals = [fact('p-sf-1', [1, 0]), fact('p-sf-2', [1, 0])];
    expect(byId(compute({ config, order, matches: [...finals, fact('p-f', [1, 1])] }), 'p-f').status).toBe('in_progress');
    expectEngineError(() => computeTournament({ config, order, matches: [...finals, fact('p-f', [3, 0])] }), 'invalid_config');
  });

  it('ignores advance and consolation in a cup and a third place match in a league', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(compute({ config: raw(cup(4), { advance: 2, consolation: true }), order, matches: [] })).toEqual(
      compute({ config: cup(4), order, matches: [] }),
    );
    expect(compute({ config: raw(league(order), { thirdPlaceMatch: true }), order, matches: [] })).toEqual(
      compute({ config: league(order), order, matches: [] }),
    );
  });
});

describe('computeTournament group and play-off', () => {
  it('puts 1 v 2 in a single final for advance 2', () => {
    const config = groupPlayoff(3, 2);
    const order = ['a', 'b', 'c'];
    const start = compute({ config, order, matches: [] });
    expect(start.fixtures.map((fixture) => fixture.id)).toEqual(['g-1', 'g-2', 'g-3', 'p-f']);
    expect(bracketFixtures(start)).toEqual(['4 p-f waiting @1 @2']);
    expect(byId(start, 'p-f')).toMatchObject({ phase: 'playoff', round: 1, bracketRound: 'final', legsToWin: 4 });
    const { state } = playOut({ config, order, matches: [] }, groupDone);
    expect(bracketFixtures(state)).toEqual(['4 p-f ready a#1 b#2']);
  });

  it('pairs 1-4 and 2-3 in the semifinals for advance 4', () => {
    const config = groupPlayoff(6, 4);
    const start = compute({ config, order: SIX, matches: [] });
    expect(bracketFixtures(start)).toEqual(['16 p-sf-1 waiting @1 @4', '17 p-sf-2 waiting @2 @3', '18 p-f waiting W(p-sf-1) W(p-sf-2)']);
    expect(start.nextFixtureId).toBe('g-1');
    const { state } = playOut({ config, order: SIX, matches: [] }, groupDone);
    expect(bracketFixtures(state)).toEqual(['16 p-sf-1 ready a#1 d#4', '17 p-sf-2 ready b#2 c#3', '18 p-f waiting W(p-sf-1) W(p-sf-2)']);
    expect(state.nextFixtureId).toBe('p-sf-1');
  });

  it('pairs 1-8, 4-5, 2-7 and 3-6 in the quarterfinals for advance 8', () => {
    const config = groupPlayoff(8, 8);
    const order = LETTERS.slice(0, 8);
    const start = compute({ config, order, matches: [] });
    expect(bracketFixtures(start).slice(0, 4)).toEqual([
      '29 p-qf-1 waiting @1 @8',
      '30 p-qf-2 waiting @4 @5',
      '31 p-qf-3 waiting @2 @7',
      '32 p-qf-4 waiting @3 @6',
    ]);
    const { state } = playOut({ config, order, matches: [] }, groupDone);
    expect(bracketFixtures(state).slice(0, 4)).toEqual([
      '29 p-qf-1 ready a#1 h#8',
      '30 p-qf-2 ready d#4 e#5',
      '31 p-qf-3 ready b#2 g#7',
      '32 p-qf-4 ready c#3 f#6',
    ]);
  });

  it('seeds the play-off by group place, not by the draw', () => {
    const order = ['f', 'e', 'd', 'c', 'b', 'a'];
    const { state } = playOut({ config: groupPlayoff(6, 4), order, matches: [] }, groupDone);
    expect(state.standings.map((row) => row.playerId)).toEqual(SIX);
    expect(bracketFixtures(state).slice(0, 2)).toEqual(['16 p-sf-1 ready a#1 d#4', '17 p-sf-2 ready b#2 c#3']);
  });

  it('numbers the reference tournament: group, semifinals, consolation, third place, final', () => {
    const state = compute({ config: groupPlayoff(6, 4, { thirdPlaceMatch: true, consolation: true }), order: SIX, matches: [] });
    expect(state.fixtures).toHaveLength(20);
    expect(state.fixtures.slice(0, 15).map((fixture) => fixture.id)).toEqual(
      state.fixtures.slice(0, 15).map((_, index) => `g-${index + 1}`),
    );
    expect(bracketFixtures(state)).toEqual([
      '16 p-sf-1 waiting @1 @4',
      '17 p-sf-2 waiting @2 @3',
      '18 c-f waiting @5 @6',
      '19 p-3rd waiting L(p-sf-1) L(p-sf-2)',
      '20 p-f waiting W(p-sf-1) W(p-sf-2)',
    ]);
    expect(byId(state, 'c-f')).toMatchObject({ phase: 'consolation', round: 1, bracketRound: 'final', legsToWin: 2 });
  });

  it.each([
    ['a third place match only', { thirdPlaceMatch: true }, ['p-sf-1', 'p-sf-2', 'p-3rd', 'p-f']],
    ['a consolation bracket only', { consolation: true }, ['p-sf-1', 'p-sf-2', 'c-f', 'p-f']],
    ['no extras', {}, ['p-sf-1', 'p-sf-2', 'p-f']],
  ])('numbers the reference tournament with %s', (_, options, bracket) => {
    const state = compute({ config: groupPlayoff(6, 4, options), order: SIX, matches: [] });
    expect(state.fixtures).toHaveLength(15 + bracket.length);
    expect(state.fixtures.slice(15).map((fixture) => fixture.id)).toEqual(bracket);
  });

  it('takes the length of each fixture from its phase', () => {
    const legsToWin = { group: 2, sf: 3, final: 5, thirdPlace: 1, consolation: 4 };
    const config = groupPlayoff(6, 4, { thirdPlaceMatch: true, consolation: true, legsToWin });
    const state = compute({ config, order: SIX, matches: [] });
    expect(state.fixtures.slice(14).map((fixture) => `${fixture.id}:${fixture.legsToWin}`)).toEqual([
      'g-15:2',
      'p-sf-1:3',
      'p-sf-2:3',
      'c-f:4',
      'p-3rd:1',
      'p-f:5',
    ]);
    expect(byId(compute({ config, order: SIX, matches: [fact('g-1', [2, 1])] }), 'g-1').status).toBe('finished');
    expectEngineError(() => computeTournament({ config, order: SIX, matches: [fact('g-1', [3, 0])] }), 'invalid_config');
  });

  it('marks the current advancing zone in the group table, but never in a league', () => {
    const start = compute({ config: groupPlayoff(6, 4), order: SIX, matches: [] });
    expect(start.standings.map((row) => row.advances)).toEqual([true, true, true, true, false, false]);
    const { state } = playOut({ config: groupPlayoff(6, 2), order: SIX, matches: [] }, groupDone);
    expect(state.standings.map((row) => [row.playerId, row.advances])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
      ['d', false],
      ['e', false],
      ['f', false],
    ]);
    expect(compute({ config: league(SIX), order: SIX, matches: REFERENCE_FACTS }).standings.some((row) => row.advances)).toBe(false);
  });
});

describe('computeTournament consolation', () => {
  it('plays one consolation final for Q = 2', () => {
    const config = groupPlayoff(6, 4, { consolation: true });
    const { state } = playOut({ config, order: SIX, matches: [] }, groupDone);
    expect(bracketFixtures(state)).toContain('18 c-f ready e#5 f#6');
  });

  it('gives group place 5 a bye for Q = 3', () => {
    const config = groupPlayoff(7, 4, { consolation: true });
    const order = LETTERS.slice(0, 7);
    const start = compute({ config, order, matches: [] });
    expect(bracketFixtures(start)).toEqual([
      '22 p-sf-1 waiting @1 @4',
      '23 p-sf-2 waiting @2 @3',
      '24 c-sf-2 waiting @6 @7',
      '25 c-f waiting @5 W(c-sf-2)',
      '26 p-f waiting W(p-sf-1) W(p-sf-2)',
      '27 c-sf-1 bye @5 bye',
    ]);
    const { state } = playOut({ config, order, matches: [] }, groupDone);
    expect(bracketFixtures(state).filter((fixture) => fixture.includes(' c-'))).toEqual([
      '24 c-sf-2 ready f#6 g#7',
      '25 c-f waiting e#5 W(c-sf-2)',
      '27 c-sf-1 bye e#5 bye',
    ]);
  });

  it.each([
    [6, 1, ['c-f']],
    [7, 2, ['c-sf-2', 'c-f']],
    [8, 3, ['c-sf-1', 'c-sf-2', 'c-f']],
  ])('builds the consolation bracket for %i players with %i playable fixtures', (n, count, ids) => {
    const state = compute({ config: groupPlayoff(n, 4, { consolation: true }), order: LETTERS.slice(0, n), matches: [] });
    const playable = state.fixtures.filter((fixture) => fixture.phase === 'consolation' && fixture.status !== 'bye');
    expect(playable).toHaveLength(count);
    expect(playable.map((fixture) => fixture.id)).toEqual(ids);
    expect(playable.every((fixture) => fixture.legsToWin === 2)).toBe(true);
  });

  it('pairs 5-8 and 6-7 for Q = 4', () => {
    const state = compute({ config: groupPlayoff(8, 4, { consolation: true }), order: LETTERS.slice(0, 8), matches: [] });
    expect(bracketFixtures(state).filter((fixture) => fixture.includes(' c-'))).toEqual([
      '31 c-sf-1 waiting @5 @8',
      '32 c-sf-2 waiting @6 @7',
      '33 c-f waiting W(c-sf-1) W(c-sf-2)',
    ]);
  });

  it('has no consolation for Q = 1 and places 5th from the table', () => {
    const config = groupPlayoff(5, 4, { consolation: true });
    const order = LETTERS.slice(0, 5);
    expect(compute({ config, order, matches: [] }).fixtures.some((fixture) => fixture.phase === 'consolation')).toBe(false);
    const { state } = playOut({ config, order, matches: [] }, groupDone);
    expect(places(state)).toEqual(['5 e']);
  });
});

describe('computeTournament placements', () => {
  it('places the consolation pair while the semifinals still run', () => {
    const config = groupPlayoff(6, 4, { consolation: true, thirdPlaceMatch: true });
    const { matches } = playOut({ config, order: SIX, matches: [] }, groupDone);
    const state = compute({ config, order: SIX, matches: [...matches, fact('p-sf-1', [1, 0]), fact('c-f', [0, 2])] });
    expect(places(state)).toEqual(['5 f', '6 e']);
    expect(state.liveFixtureId).toBe('p-sf-1');
    expect(state.status).toBe('in_progress');
  });

  it('places everyone outside the play-off from the table once the group ends without consolation', () => {
    const config = groupPlayoff(6, 4);
    const before = playOut({ config, order: SIX, matches: [] }, (state) => state.nextFixtureId === 'g-15').state;
    expect(before.placements).toEqual([]);
    const { state } = playOut({ config, order: SIX, matches: [] }, groupDone);
    expect(places(state)).toEqual(['5 e', '6 f']);
  });

  it('places losers of an earlier consolation round behind the players still in', () => {
    const config = groupPlayoff(8, 4, { consolation: true });
    const order = LETTERS.slice(0, 8);
    const { state } = playOut({ config, order, matches: [] }, (current) => current.nextFixtureId === 'c-f');
    expect(places(state)).toEqual(['3 c', '3 d', '7 g', '8 h']);
    const { state: q3 } = playOut(
      { config: groupPlayoff(7, 4, { consolation: true }), order: order.slice(0, 7), matches: [] },
      (current) => current.nextFixtureId === 'c-f',
    );
    expect(places(q3)).toEqual(['3 c', '3 d', '7 g']);
  });

  it('shares the place of cup losers in a round once the round is decided', () => {
    const order = LETTERS.slice(0, 8);
    const { state } = playOut({ config: cup(8), order, matches: [] }, (current) => current.nextFixtureId === 'p-qf-4');
    expect(state.placements).toEqual([]);
    const { state: afterQuarters } = playOut({ config: cup(8), order, matches: [] }, (current) => current.nextFixtureId === 'p-sf-1');
    expect(places(afterQuarters)).toEqual(['5 e', '5 f', '5 g', '5 h']);
  });

  it('gives consecutive places to play-off quarterfinal losers by group place', () => {
    const order = LETTERS.slice(0, 8);
    const { state } = playOut({ config: groupPlayoff(8, 8), order, matches: [] }, (current) => current.nextFixtureId === 'p-sf-1');
    expect(places(state)).toEqual(['5 e', '6 f', '7 g', '8 h']);
  });

  it('ends an 11-player cup with shared places', () => {
    const { state } = playOut({ config: cup(11), order: LETTERS.slice(0, 11), matches: [] });
    expect(places(state)).toEqual(['1 a', '2 b', '3 c', '3 d', '5 e', '5 f', '5 g', '5 h', '9 i', '9 j', '9 k']);
    expect(state.status).toBe('finished');
  });

  it('ends a cup with a third place match and a cup of 3', () => {
    const order = ['c', 'b', 'a', 'd'];
    const { state } = playOut({ config: cup(4, { thirdPlaceMatch: true }), order, matches: [] });
    expect(byId(state, 'p-3rd').result?.winnerId).toBe('b');
    expect(places(state)).toEqual(['1 a', '2 c', '3 b', '4 d']);
    const { state: three } = playOut({ config: cup(3, { thirdPlaceMatch: true }), order: ['a', 'b', 'c'], matches: [] });
    expect(places(three)).toEqual(['1 a', '2 b', '3 c']);
  });

  it('ends a group and play-off with a third place match and a consolation bracket', () => {
    const config = groupPlayoff(6, 4, { thirdPlaceMatch: true, consolation: true });
    const { state } = playOut({ config, order: SIX, matches: [] });
    expect(state.status).toBe('finished');
    expect(places(state)).toEqual(['1 a', '2 b', '3 c', '4 d', '5 e', '6 f']);
  });

  it('ends a group and play-off without a third place match with shared third places', () => {
    const { state } = playOut({ config: groupPlayoff(7, 4, { consolation: true }), order: LETTERS.slice(0, 7), matches: [] });
    expect(places(state)).toEqual(['1 a', '2 b', '3 c', '3 d', '5 e', '6 f', '7 g']);
    const { state: eight } = playOut({ config: groupPlayoff(10, 8), order: LETTERS.slice(0, 10), matches: [] });
    expect(places(eight)).toEqual(['1 a', '2 b', '3 c', '3 d', '5 e', '6 f', '7 g', '8 h', '9 i', '10 j']);
    const { state: final } = playOut({ config: groupPlayoff(3, 2), order: ['a', 'b', 'c'], matches: [] });
    expect(places(final)).toEqual(['1 a', '2 b', '3 c']);
  });
});
