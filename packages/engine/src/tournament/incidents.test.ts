import { Fixture, StandingRow, TournamentConfig, TournamentPlacement } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  computeTournament,
  correctResult,
  EngineError,
  hasStartedDependent,
  TournamentError,
  withdrawPlayer,
  type FixtureFact,
  type FixtureScoring,
  type ResultCorrection,
  type TournamentInput,
  type TournamentState,
} from '../index.js';

function league(playerIds: readonly string[], group = 3): TournamentConfig {
  return TournamentConfig.parse({ name: 'Liga', format: 'league', playerIds, legsToWin: { group } });
}

function cup(playerIds: readonly string[], options: object = {}): TournamentConfig {
  return TournamentConfig.parse({ name: 'Puchar', format: 'cup', playerIds, ...options });
}

function groupPlayoff(playerIds: readonly string[], advance: number): TournamentConfig {
  return TournamentConfig.parse({ name: 'Grupa', format: 'group_playoff', playerIds, advance });
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
function checked(state: TournamentState): TournamentState {
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

const compute = (input: TournamentInput) => checked(computeTournament(input));
const withdraw = (input: TournamentInput, playerId: string) => checked(withdrawPlayer(input, playerId));
const correct = (input: TournamentInput, correction: ResultCorrection) => checked(correctResult(input, correction));

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

function expectTournamentError(fn: () => unknown, code: TournamentError['code']) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TournamentError);
    expect(error).not.toBeInstanceOf(EngineError);
    expect((error as TournamentError).code).toBe(code);
    return;
  }
  throw new Error(`Expected TournamentError ${code}`);
}

function byId(state: TournamentState, id: string): Fixture {
  const fixture = state.fixtures.find((candidate) => candidate.id === id);
  if (!fixture) {
    throw new Error(`No fixture ${id}`);
  }
  return fixture;
}

function players(fixture: Fixture): string[] {
  return fixture.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : slot.kind));
}

function table(state: TournamentState): string[] {
  return state.standings.map((row) => row.playerId);
}

function places(state: TournamentState): string[] {
  return state.placements.map((placement) => `${placement.place} ${placement.playerId}`);
}

const FOUR = ['a', 'b', 'c', 'd'];
const THREE = ['a', 'b', 'c'];
const EIGHT = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Grupa z play-off dla 3 graczy: g-1 b-c, g-2 a-c, g-3 a-b, finał 1. v 2. miejsce z grupy.
const PLAYOFF_OF_THREE: TournamentInput = {
  config: groupPlayoff(THREE, 2),
  order: THREE,
  matches: [fact('g-1', [3, 0]), fact('g-2', [3, 0]), fact('g-3', [3, 0])],
};

describe('withdrawal', () => {
  it('turns the remaining group matches into walkovers and keeps the played ones in the table', () => {
    const input: TournamentInput = {
      config: league(FOUR),
      order: FOUR,
      matches: [fact('g-1', [3, 1], [score(300, 30), score(150, 30)]), fact('g-2', [3, 2], [score(180, 18), score(90, 18)])],
    };
    const state = withdraw(input, 'd');
    for (const id of ['g-4', 'g-6']) {
      expect(byId(state, id)).toMatchObject({
        status: 'walkover',
        matchId: null,
        result: { legs: [3, 0], corrected: false },
        averages: null,
      });
    }
    expect(byId(state, 'g-4').result?.winnerId).toBe('b');
    expect(byId(state, 'g-6').result?.winnerId).toBe('c');
    expect(table(state)).toEqual(['b', 'a', 'c', 'd']);
    expect(state.standings[0]).toMatchObject({ played: 2, won: 2, legsFor: 6, legsAgainst: 2, points: 4, average: 30 });
    expect(state.standings[1]).toMatchObject({ playerId: 'a', points: 2, legDifference: 2, average: 30 });
    expect(state.standings[2]).toMatchObject({ playerId: 'c', points: 2, legDifference: 2, average: 15 });
    expect(state.standings[3]).toMatchObject({ played: 3, lost: 3, legsFor: 1, legsAgainst: 9, average: 15, withdrawn: true });
    expect(state.standings.filter((row) => row.withdrawn).map((row) => row.playerId)).toEqual(['d']);
    expect(state.status).toBe('in_progress');
    expect(state.nextFixtureId).toBe('g-3');
  });

  it('abandons the match in progress as a walkover that keeps its match id', () => {
    const config = cup(FOUR, { thirdPlaceMatch: true });
    const input: TournamentInput = { config, order: FOUR, matches: [fact('p-sf-1', [1, 0])] };
    expect(compute(input).liveFixtureId).toBe('p-sf-1');
    const state = withdraw(input, 'd');
    expect(byId(state, 'p-sf-1')).toMatchObject({
      status: 'walkover',
      matchId: 'm-p-sf-1',
      result: { legs: [3, 0], winnerId: 'a', corrected: false },
      averages: null,
    });
    expect(state.liveFixtureId).toBeNull();
    expect(state.nextFixtureId).toBe('p-sf-2');

    const withdrawals = ['d'];
    const afterSemifinal = compute({ ...input, withdrawals, matches: [...input.matches, fact('p-sf-2', [3, 1])] });
    expect(byId(afterSemifinal, 'p-f').status).toBe('ready');
    expect(players(byId(afterSemifinal, 'p-f'))).toEqual(['a', 'b']);
    expect(players(byId(afterSemifinal, 'p-3rd'))).toEqual(['d', 'c']);
    expect(byId(afterSemifinal, 'p-3rd')).toMatchObject({ status: 'walkover', matchId: null, result: { legs: [0, 2], winnerId: 'c' } });

    const end = compute({ ...input, withdrawals, matches: [...input.matches, fact('p-sf-2', [3, 1]), fact('p-f', [4, 2])] });
    expect(places(end)).toEqual(['1 a', '2 b', '3 c', '4 d']);
    expect(end.status).toBe('finished');
  });

  it('changes nothing but the mark for an eliminated player or one who played every match', () => {
    const knockedOut: TournamentInput = { config: cup(FOUR), order: FOUR, matches: [fact('p-sf-1', [3, 1])] };
    expect(withdraw(knockedOut, 'd')).toEqual(compute(knockedOut));

    const played: TournamentInput = { config: league(THREE), order: THREE, matches: [fact('g-2', [3, 1]), fact('g-3', [3, 2])] };
    const before = compute(played);
    const after = withdraw(played, 'a');
    expect(after.fixtures).toEqual(before.fixtures);
    expect(after.standings).toEqual(before.standings.map((row) => ({ ...row, withdrawn: row.playerId === 'a' })));
    expect({ ...after, standings: [] }).toEqual({ ...before, standings: [] });
  });

  it('finishes a league through walkovers with placements from the table', () => {
    const input: TournamentInput = { config: league(THREE), order: THREE, matches: [fact('g-1', [3, 0]), fact('g-3', [3, 1])] };
    const state = withdraw(input, 'c');
    expect(byId(state, 'g-2')).toMatchObject({ status: 'walkover', result: { legs: [3, 0], winnerId: 'a' } });
    expect(state.status).toBe('finished');
    expect(state.nextFixtureId).toBeNull();
    expect(places(state)).toEqual(['1 a', '2 b', '3 c']);
  });

  it('gives the walkover to the player who withdrew later when both withdrew', () => {
    const state = compute({ config: league(FOUR), order: FOUR, matches: [], withdrawals: ['d', 'a'] });
    expect(byId(state, 'g-1')).toMatchObject({ status: 'walkover', result: { legs: [3, 0], winnerId: 'a' } });
    expect(byId(state, 'g-3')).toMatchObject({ status: 'walkover', result: { legs: [0, 3], winnerId: 'c' } });
    expect(byId(state, 'g-2').status).toBe('ready');
  });

  it('seeds a withdrawn player from the advancing zone, who then loses the play-off by walkover', () => {
    const input: TournamentInput = { config: groupPlayoff(THREE, 2), order: THREE, matches: [fact('g-1', [3, 0]), fact('g-2', [3, 0])] };
    const state = withdraw(input, 'b');
    expect(byId(state, 'g-3')).toMatchObject({ status: 'walkover', result: { legs: [3, 0], winnerId: 'a' } });
    expect(state.standings.map(({ playerId, withdrawn, advances }) => ({ playerId, withdrawn, advances }))).toEqual([
      { playerId: 'a', withdrawn: false, advances: true },
      { playerId: 'b', withdrawn: true, advances: true },
      { playerId: 'c', withdrawn: false, advances: false },
    ]);
    const final = byId(state, 'p-f');
    expect(final.slots).toEqual([
      { kind: 'player', playerId: 'a', seed: 1 },
      { kind: 'player', playerId: 'b', seed: 2 },
    ]);
    expect(final).toMatchObject({ status: 'walkover', result: { legs: [4, 0], winnerId: 'a' } });
    expect(places(state)).toEqual(['1 a', '2 b', '3 c']);
    expect(state.status).toBe('finished');
  });

  it('keeps a withdrawn player waiting until the other slot is known', () => {
    const state = compute({ config: cup(FOUR, { thirdPlaceMatch: true }), order: FOUR, matches: [], withdrawals: ['d'] });
    expect(byId(state, 'p-sf-1')).toMatchObject({ status: 'walkover', result: { winnerId: 'a' } });
    expect(players(byId(state, 'p-3rd'))).toEqual(['d', 'loser_of']);
    expect(byId(state, 'p-3rd').status).toBe('waiting');
    expect(byId(state, 'p-f').status).toBe('waiting');
  });

  it('allows the redraw after a withdrawal while no match has started', () => {
    expect(compute({ config: league(THREE), order: THREE, matches: [], withdrawals: ['a'] }).canRedraw).toBe(true);
  });
});

describe('correction', () => {
  it('changes the winner, the table and the play-off seeding', () => {
    expect(players(byId(compute(PLAYOFF_OF_THREE), 'p-f'))).toEqual(['a', 'b']);
    const state = correct(PLAYOFF_OF_THREE, { fixtureId: 'g-1', legs: [0, 3] });
    expect(byId(state, 'g-1')).toMatchObject({
      status: 'finished',
      matchId: 'm-g-1',
      result: { legs: [0, 3], winnerId: 'c', corrected: true },
    });
    expect(table(state)).toEqual(['a', 'c', 'b']);
    expect(byId(state, 'p-f').slots).toEqual([
      { kind: 'player', playerId: 'a', seed: 1 },
      { kind: 'player', playerId: 'c', seed: 2 },
    ]);
  });

  it('keeps the darts of the match, so the averages stay', () => {
    const input: TournamentInput = {
      config: league(THREE),
      order: THREE,
      matches: [fact('g-1', [3, 1], [score(300, 30), score(150, 30)])],
    };
    const state = correct(input, { fixtureId: 'g-1', legs: [2, 3] });
    expect(byId(state, 'g-1')).toMatchObject({ averages: [30, 15], result: { legs: [2, 3], winnerId: 'c', corrected: true } });
    expect(state.standings.find((row) => row.playerId === 'b')).toMatchObject({ won: 0, legsFor: 2, legsAgainst: 3, average: 30 });
  });

  it('takes the last of two corrections of one fixture', () => {
    const corrections: ResultCorrection[] = [{ fixtureId: 'g-1', legs: [0, 3] }];
    const back = correct({ ...PLAYOFF_OF_THREE, corrections }, { fixtureId: 'g-1', legs: [3, 0] });
    expect(byId(back, 'g-1').result).toEqual({ legs: [3, 0], winnerId: 'b', corrected: true });
    expect(table(back)).toEqual(['a', 'b', 'c']);
    expect(players(byId(back, 'p-f'))).toEqual(['a', 'b']);

    const twice = compute({ ...PLAYOFF_OF_THREE, corrections: [...corrections, { fixtureId: 'g-1', legs: [1, 3] }] });
    expect(byId(twice, 'g-1').result).toEqual({ legs: [1, 3], winnerId: 'c', corrected: true });
  });

  it('keeps the corrected result when an undo later takes the winner from the match', () => {
    const state = compute({
      config: league(THREE),
      order: THREE,
      matches: [fact('g-1', [2, 0])],
      corrections: [{ fixtureId: 'g-1', legs: [3, 1] }],
    });
    expect(byId(state, 'g-1')).toMatchObject({
      status: 'finished',
      matchId: 'm-g-1',
      result: { legs: [3, 1], winnerId: 'b', corrected: true },
    });
    expect(state.liveFixtureId).toBeNull();
  });

  it('wins over a later withdrawal', () => {
    const input: TournamentInput = { config: league(THREE), order: THREE, matches: [fact('g-1', [1, 0])], corrections: [] };
    const corrected = compute({ ...input, corrections: [{ fixtureId: 'g-1', legs: [1, 3] }], withdrawals: ['c'] });
    expect(byId(corrected, 'g-1')).toMatchObject({ status: 'finished', result: { winnerId: 'c', corrected: true } });
  });
});

describe('hasStartedDependent', () => {
  it('blocks a group correction once the play-off has started', () => {
    expect(hasStartedDependent(PLAYOFF_OF_THREE, 'g-1')).toBe(false);
    const started = { ...PLAYOFF_OF_THREE, matches: [...PLAYOFF_OF_THREE.matches, fact('p-f', [1, 0])] };
    expect(hasStartedDependent(started, 'g-1')).toBe(true);
    expectTournamentError(() => correctResult(started, { fixtureId: 'g-1', legs: [0, 3] }), 'dependent_started');
  });

  it('follows a loser_of slot to the third place match', () => {
    const input: TournamentInput = {
      config: cup(FOUR, { thirdPlaceMatch: true }),
      order: FOUR,
      matches: [fact('p-sf-1', [3, 1]), fact('p-sf-2', [3, 1])],
    };
    expect(hasStartedDependent(input, 'p-sf-1')).toBe(false);
    expect(correct(input, { fixtureId: 'p-sf-1', legs: [1, 3] }).fixtures.find((f) => f.id === 'p-3rd')?.slots[0]).toEqual({
      kind: 'player',
      playerId: 'a',
      seed: 1,
    });
    const started = { ...input, matches: [...input.matches, fact('p-3rd', [1, 0])] };
    expect(hasStartedDependent(started, 'p-sf-1')).toBe(true);
    expect(hasStartedDependent(started, 'p-3rd')).toBe(false);
    expectTournamentError(() => correctResult(started, { fixtureId: 'p-sf-1', legs: [1, 3] }), 'dependent_started');
  });

  it('reaches the final through a walkover without a match', () => {
    const quarterfinals = ['p-qf-1', 'p-qf-2', 'p-qf-3', 'p-qf-4'].map((id) => fact(id, [3, 0]));
    const input: TournamentInput = {
      config: cup(EIGHT),
      order: EIGHT,
      matches: [...quarterfinals, fact('p-sf-2', [3, 0])],
      withdrawals: ['d'],
    };
    const state = compute(input);
    expect(byId(state, 'p-sf-1')).toMatchObject({ status: 'walkover', matchId: null, result: { winnerId: 'a' } });
    expect(players(byId(state, 'p-f'))).toEqual(['a', 'b']);
    expect(hasStartedDependent(input, 'p-qf-1')).toBe(false);
    const started = { ...input, matches: [...input.matches, fact('p-f', [1, 0])] };
    expect(hasStartedDependent(started, 'p-qf-1')).toBe(true);
    expect(hasStartedDependent(started, 'p-qf-3')).toBe(true);
  });

  it('is always false in a league', () => {
    const input: TournamentInput = {
      config: league(THREE),
      order: THREE,
      matches: [fact('g-1', [3, 0]), fact('g-2', [3, 0]), fact('g-3', [1, 0])],
    };
    for (const id of ['g-1', 'g-2', 'g-3']) {
      expect(hasStartedDependent(input, id)).toBe(false);
    }
  });

  it('rejects an unknown fixture and an invalid input', () => {
    expectEngineError(() => hasStartedDependent(PLAYOFF_OF_THREE, 'p-sf-1'), 'invalid_config');
    expectEngineError(() => hasStartedDependent({ ...PLAYOFF_OF_THREE, withdrawals: ['z'] }, 'g-1'), 'invalid_config');
  });
});

describe('rejected commands', () => {
  const finished: TournamentInput = { config: league(THREE), order: THREE, matches: [fact('g-1', [3, 1]), fact('g-2', [1, 0])] };

  it('rejects a correction of a fixture that is unknown or not finished', () => {
    expectTournamentError(() => correctResult(finished, { fixtureId: 'g-9', legs: [3, 0] }), 'invalid_correction');
    expectTournamentError(() => correctResult(finished, { fixtureId: 'g-3', legs: [3, 0] }), 'invalid_correction');
    expectTournamentError(() => correctResult(finished, { fixtureId: 'g-2', legs: [3, 0] }), 'invalid_correction');
    const abandoned = { ...finished, withdrawals: ['c'] };
    expect(byId(compute(abandoned), 'g-2').status).toBe('walkover');
    expectTournamentError(() => correctResult(abandoned, { fixtureId: 'g-2', legs: [3, 0] }), 'invalid_correction');
    const cupOfThree: TournamentInput = { config: cup(THREE), order: THREE, matches: [] };
    expect(byId(compute(cupOfThree), 'p-sf-1').status).toBe('bye');
    expectTournamentError(() => correctResult(cupOfThree, { fixtureId: 'p-sf-1', legs: [3, 0] }), 'invalid_correction');
    expect(byId(compute(cupOfThree), 'p-f').status).toBe('waiting');
    expectTournamentError(() => correctResult(cupOfThree, { fixtureId: 'p-f', legs: [4, 0] }), 'invalid_correction');
  });

  it.each([
    [3, 3],
    [2, 1],
    [4, 0],
    [1.5, 3],
    [-1, 3],
  ])('rejects corrected legs %d:%d in a group of 3', (first, second) => {
    expectTournamentError(() => correctResult(finished, { fixtureId: 'g-1', legs: [first, second] }), 'invalid_correction');
  });

  it('rejects a withdrawal of an unknown or already withdrawn player', () => {
    expectTournamentError(() => withdrawPlayer(finished, 'z'), 'invalid_withdrawal');
    expectTournamentError(() => withdrawPlayer({ ...finished, withdrawals: ['b'] }, 'b'), 'invalid_withdrawal');
  });

  it('allows a withdrawal after the end of the tournament', () => {
    const end = compute({ ...PLAYOFF_OF_THREE, matches: [...PLAYOFF_OF_THREE.matches, fact('p-f', [4, 1])] });
    const after = withdraw({ ...PLAYOFF_OF_THREE, matches: [...PLAYOFF_OF_THREE.matches, fact('p-f', [4, 1])] }, 'c');
    expect(after.status).toBe('finished');
    expect(after.fixtures).toEqual(end.fixtures);
    expect(after.placements).toEqual(end.placements);
  });
});

describe('replay of withdrawals and corrections rejects', () => {
  const input: TournamentInput = { config: league(THREE), order: THREE, matches: [fact('g-1', [3, 1])] };

  it('an unknown or repeated withdrawal', () => {
    expectEngineError(() => computeTournament({ ...input, withdrawals: ['z'] }), 'invalid_config');
    expectEngineError(() => computeTournament({ ...input, withdrawals: ['a', 'a'] }), 'invalid_config');
  });

  it('a correction of an unknown fixture or of a fixture without a match', () => {
    expectEngineError(() => computeTournament({ ...input, corrections: [{ fixtureId: 'g-9', legs: [3, 0] }] }), 'invalid_config');
    expectEngineError(() => computeTournament({ ...input, corrections: [{ fixtureId: 'g-2', legs: [3, 0] }] }), 'invalid_config');
  });

  it.each([
    [3, 3],
    [2, 1],
    [4, 0],
    [1.5, 3],
  ])('a correction with legs %d:%d', (first, second) => {
    expectEngineError(() => computeTournament({ ...input, corrections: [{ fixtureId: 'g-1', legs: [first, second] }] }), 'invalid_config');
  });
});
