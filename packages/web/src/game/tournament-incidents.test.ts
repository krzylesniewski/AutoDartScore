import type { Fixture, TournamentView } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { computedView, fixture, playedResults, tournamentConfig } from '../test/snapshots';
import {
  correctableFixtures,
  correctionImpact,
  isValidCorrection,
  openFixturesOf,
  withdrawCandidates,
  withdrawnPlayerIds,
} from './tournament-incidents';

function find(view: TournamentView, id: string): Fixture {
  const found = view.fixtures.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`No fixture ${id}`);
  }
  return found;
}

function involves(entry: Fixture, playerId: string): boolean {
  return entry.slots.some((slot) => slot.kind === 'player' && slot.playerId === playerId);
}

const LEAGUE = tournamentConfig('league', 4);
const CUP = tournamentConfig('cup', 4);

describe('withdrawnPlayerIds', () => {
  it('is empty without incidents', () => {
    expect(withdrawnPlayerIds(computedView(LEAGUE))).toEqual(new Set());
  });

  it('takes a withdrawn league player from the standings and the walkovers', () => {
    const view = computedView(LEAGUE, {}, {}, { withdrawals: ['p3'] });
    expect(view.standings.find((row) => row.playerId === 'p3')?.withdrawn).toBe(true);
    expect(withdrawnPlayerIds(view)).toEqual(new Set(['p3']));
  });

  it('finds a withdrawn cup player through the walkover loser', () => {
    const view = computedView(CUP, {}, {}, { withdrawals: ['p4'] });
    expect(view.standings).toEqual([]);
    expect(find(view, 'p-sf-1').status).toBe('walkover');
    expect(withdrawnPlayerIds(view)).toEqual(new Set(['p4']));
  });

  it('keeps a withdrawn league player who had no open fixtures', () => {
    const results = playedResults(LEAGUE, {}, (entry) => involves(entry, 'p2'));
    const view = computedView(LEAGUE, results, {}, { withdrawals: ['p2'] });
    expect(view.fixtures.some((entry) => entry.status === 'walkover')).toBe(false);
    expect(withdrawnPlayerIds(view)).toEqual(new Set(['p2']));
  });
});

describe('openFixturesOf', () => {
  it('lists the waiting, ready and running fixtures of the player', () => {
    const own = computedView(LEAGUE).fixtures.filter((entry) => involves(entry, 'p1'));
    const [played, running] = own;
    if (!played || !running) {
      throw new Error('Missing fixtures');
    }
    const view = computedView(LEAGUE, { [played.id]: [3, 0], [running.id]: [1, 1] });
    const open = openFixturesOf(view, 'p1');
    expect(open).toHaveLength(own.length - 1);
    expect(open.map((entry) => entry.id)).not.toContain(played.id);
    expect(open.find((entry) => entry.status === 'in_progress')?.id).toBe(running.id);
  });

  it('counts a waiting cup fixture with the player in a slot', () => {
    const view = computedView(tournamentConfig('cup', 3));
    expect(find(view, 'p-f').status).toBe('waiting');
    expect(openFixturesOf(view, 'p1').map((entry) => entry.id)).toEqual(['p-f']);
  });

  it('is empty for an eliminated cup player', () => {
    const view = computedView(CUP, { 'p-sf-1': [3, 1] });
    expect(openFixturesOf(view, 'p4')).toEqual([]);
  });
});

describe('withdrawCandidates', () => {
  it('offers every player in entry order without incidents', () => {
    expect(withdrawCandidates(computedView(LEAGUE)).map((player) => player.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('leaves out withdrawn players, also without open fixtures', () => {
    const results = playedResults(LEAGUE, {}, (entry) => involves(entry, 'p2'));
    const view = computedView(LEAGUE, results, {}, { withdrawals: ['p2', 'p4'] });
    expect(withdrawCandidates(view).map((player) => player.id)).toEqual(['p1', 'p3']);
  });

  it('keeps a league player without open fixtures', () => {
    const results = playedResults(LEAGUE, {}, (entry) => involves(entry, 'p2'));
    expect(openFixturesOf(computedView(LEAGUE, results), 'p2')).toEqual([]);
    expect(withdrawCandidates(computedView(LEAGUE, results)).map((player) => player.id)).toContain('p2');
  });

  it('leaves out a cup walkover loser and an eliminated cup player', () => {
    const view = computedView(CUP, { 'p-sf-2': [3, 1] }, {}, { withdrawals: ['p4'] });
    expect(withdrawCandidates(view).map((player) => player.id)).toEqual(['p1', 'p2']);
  });
});

describe('correctableFixtures', () => {
  it('returns finished fixtures by number without walkovers and running matches', () => {
    const all = computedView(LEAGUE).fixtures;
    const [first, second, third] = all.filter((entry) => involves(entry, 'p1')).sort((a, b) => b.number - a.number);
    if (!first || !second || !third) {
      throw new Error('Missing fixtures');
    }
    const view = computedView(LEAGUE, { [first.id]: [3, 2], [second.id]: [0, 3], [third.id]: [2, 2] }, {}, { withdrawals: ['p4'] });
    const numbers = correctableFixtures(view).map((entry) => entry.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(correctableFixtures(view).every((entry) => entry.status === 'finished')).toBe(true);
    expect(correctableFixtures(view).map((entry) => entry.id)).not.toContain(third.id);
    expect(view.fixtures.some((entry) => entry.status === 'walkover')).toBe(true);
  });
});

describe('isValidCorrection', () => {
  it.each([
    [[3, 0], true],
    [[2, 3], true],
    [[3, 2], true],
    [[3, 3], false],
    [[2, 2], false],
    [[0, 0], false],
    [[4, 0], false],
    [[-1, 3], false],
  ] as const)('checks %j against legsToWin 3', (legs, valid) => {
    expect(isValidCorrection(legs, 3)).toBe(valid);
  });

  it('accepts 1–0 in a match to one leg', () => {
    expect(isValidCorrection([1, 0], 1)).toBe(true);
    expect(isValidCorrection([1, 1], 1)).toBe(false);
  });
});

describe('correctionImpact', () => {
  it('names the league table for a league fixture and the group for a group fixture', () => {
    const league = computedView(LEAGUE);
    expect(correctionImpact(league, fixture())).toBe('league');
    const group = computedView(tournamentConfig('group_playoff', 6, { advance: 4 }));
    expect(correctionImpact(group, fixture())).toBe('group');
  });

  it.each(['playoff', 'third_place', 'consolation'] as const)('names the bracket for a %s fixture', (phase) => {
    const view = computedView(tournamentConfig('group_playoff', 6, { advance: 4 }));
    expect(correctionImpact(view, fixture({ phase }))).toBe('bracket');
  });
});
