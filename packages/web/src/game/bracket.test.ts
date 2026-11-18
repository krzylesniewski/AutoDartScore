import type { Fixture, TournamentView } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { computedView, playedResults, tournamentConfig } from '../test/snapshots';
import { bracketColumns, fixtureTag } from './bracket';

function cup(players: number): TournamentView {
  return computedView(tournamentConfig('cup', players));
}

function find(view: TournamentView, id: string): Fixture {
  const found = view.fixtures.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`No fixture ${id}`);
  }
  return found;
}

function shape(view: TournamentView, phase: 'playoff' | 'consolation') {
  return bracketColumns(view, phase).map((column) => column.fixtures.map((entry) => entry.id));
}

describe('bracketColumns: cup', () => {
  it.each([
    [3, [2, 1]],
    [4, [2, 1]],
    [5, [4, 2, 1]],
    [8, [4, 2, 1]],
    [16, [8, 4, 2, 1]],
  ])('splits a cup of %i players into columns of %j', (players, sizes) => {
    const columns = bracketColumns(cup(players), 'playoff');
    expect(columns.map((column) => column.fixtures.length)).toEqual(sizes);
    expect(columns.map((column) => column.round)).toEqual(sizes.map((_, index) => index + 1));
  });

  it('names the rounds and takes the match length from the fixtures', () => {
    const columns = bracketColumns(cup(16), 'playoff');
    expect(columns.map((column) => column.bracketRound)).toEqual(['r16', 'qf', 'sf', 'final']);
    expect(columns.map((column) => column.legsToWin)).toEqual([3, 3, 3, 4]);
  });

  it('puts the byes of a cup of 3 and of 5 in the expected boxes', () => {
    const three = cup(3);
    expect(shape(three, 'playoff')).toEqual([['p-sf-1', 'p-sf-2'], ['p-f']]);
    expect(find(three, 'p-sf-1').status).toBe('bye');
    expect(find(three, 'p-sf-2').status).toBe('ready');

    const five = cup(5);
    const first = bracketColumns(five, 'playoff')[0]?.fixtures ?? [];
    expect(first.map((entry) => entry.status)).toEqual(['bye', 'ready', 'bye', 'bye']);
    expect(first.map((entry) => entry.slots.map((slot) => (slot.kind === 'player' ? slot.seed : slot.kind)))).toEqual([
      [1, 'bye'],
      [4, 5],
      [2, 'bye'],
      [3, 'bye'],
    ]);
  });

  it('orders a column by the id ordinal, not by the play order number', () => {
    const five = cup(5);
    const first = bracketColumns(five, 'playoff')[0]?.fixtures ?? [];
    expect(first.map((entry) => entry.id)).toEqual(['p-qf-1', 'p-qf-2', 'p-qf-3', 'p-qf-4']);
    // Wolne losy mają najwyższe numery, więc kolejność po numerze byłaby inna.
    expect(first.map((entry) => entry.number)).toEqual([5, 1, 6, 7]);
  });

  it('has no consolation in a cup', () => {
    expect(bracketColumns(cup(8), 'consolation')).toEqual([]);
  });
});

describe('bracketColumns: group and play-off', () => {
  it.each<[number, 2 | 4 | 8, number[]]>([
    [4, 2, [1]],
    [6, 4, [2, 1]],
    [9, 8, [4, 2, 1]],
  ])('builds the play-off of %i players with %i advancing as %j', (players, advance, sizes) => {
    const view = computedView(tournamentConfig('group_playoff', players, { advance }));
    expect(bracketColumns(view, 'playoff').map((column) => column.fixtures.length)).toEqual(sizes);
    expect(view.fixtures.filter((entry) => entry.phase === 'playoff').every((entry) => entry.status !== 'bye')).toBe(true);
  });

  it('builds a consolation of 2 players as one final', () => {
    const view = computedView(tournamentConfig('group_playoff', 6, { advance: 4, consolation: true }));
    const columns = bracketColumns(view, 'consolation');
    expect(shape(view, 'consolation')).toEqual([['c-f']]);
    expect(columns[0]?.legsToWin).toBe(2);
  });

  it('builds a consolation of 3 players with a bye in the first semi-final', () => {
    const view = computedView(tournamentConfig('group_playoff', 7, { advance: 4, consolation: true }));
    expect(shape(view, 'consolation')).toEqual([['c-sf-1', 'c-sf-2'], ['c-f']]);
    expect(find(view, 'c-sf-1').status).toBe('bye');
    expect(find(view, 'c-sf-2').status).toBe('waiting');
  });

  it('leaves the third place match out of the columns', () => {
    const view = computedView(tournamentConfig('group_playoff', 6, { advance: 4, thirdPlaceMatch: true }));
    expect(shape(view, 'playoff')).toEqual([['p-sf-1', 'p-sf-2'], ['p-f']]);
  });
});

describe('fixtureTag', () => {
  it('describes a finished, a walkover, a ready and a bye fixture', () => {
    const view = computedView(tournamentConfig('cup', 3), { 'p-sf-2': [3, 1] });
    const semi = find(view, 'p-sf-2');
    expect(fixtureTag(view, semi, null)).toBe('Mecz #1 · zakończony');
    expect(fixtureTag(view, { ...semi, status: 'walkover' }, null)).toBe('Mecz #1 · walkower');
    expect(fixtureTag(view, find(view, 'p-f'), null)).toBe('Mecz #2 · do rozegrania');
    expect(fixtureTag(view, find(view, 'p-sf-1'), null)).toBe('Awans bez meczu');
  });

  it('marks a corrected result and keeps the walkover text', () => {
    const config = tournamentConfig('cup', 4);
    const corrected = computedView(config, { 'p-sf-1': [3, 1] }, {}, { corrections: [{ fixtureId: 'p-sf-1', legs: [1, 3] }] });
    expect(find(corrected, 'p-sf-1').result?.corrected).toBe(true);
    expect(fixtureTag(corrected, find(corrected, 'p-sf-1'), null)).toBe('Mecz #1 · zakończony, wynik poprawiony');
    const walkover = computedView(config, {}, {}, { withdrawals: ['p4'] });
    const forfeited = walkover.fixtures.find((entry) => entry.status === 'walkover');
    if (!forfeited) {
      throw new Error('No walkover');
    }
    expect(fixtureTag(walkover, forfeited, null)).toBe(`Mecz #${forfeited.number} · walkower`);
  });

  it('describes a live fixture with and without the leg number', () => {
    const view = computedView(tournamentConfig('cup', 4), { 'p-sf-1': [1, 1] });
    const live = find(view, 'p-sf-1');
    expect(live.status).toBe('in_progress');
    expect(fixtureTag(view, live, 3)).toBe('Mecz #1 · na żywo, leg 3');
    expect(fixtureTag(view, live, null)).toBe('Mecz #1 · na żywo');
  });

  it('names the round a waiting fixture waits for', () => {
    expect(fixtureTag(cup(4), find(cup(4), 'p-f'), null)).toBe('Mecz #3 · po półfinałach');
    expect(fixtureTag(cup(8), find(cup(8), 'p-sf-1'), null)).toBe('Mecz #5 · po ćwierćfinałach');
    expect(fixtureTag(cup(16), find(cup(16), 'p-qf-2'), null)).toBe('Mecz #10 · po 1/8 finału');
    const thirdPlace = computedView(tournamentConfig('cup', 4, { thirdPlaceMatch: true }));
    expect(fixtureTag(thirdPlace, find(thirdPlace, 'p-3rd'), null)).toBe('Mecz #3 · po półfinałach');
  });

  it('waits for the group while the group runs', () => {
    const view = computedView(tournamentConfig('group_playoff', 6, { advance: 4 }));
    expect(fixtureTag(view, find(view, 'p-sf-1'), null)).toBe('Mecz #16 · po fazie grupowej');
  });

  it('waits for the semi-finals once the group is done', () => {
    const config = tournamentConfig('group_playoff', 6, { advance: 4 });
    const view = computedView(
      config,
      playedResults(config, {}, (entry) => entry.phase === 'group'),
    );
    expect(find(view, 'p-sf-1').status).toBe('ready');
    expect(fixtureTag(view, find(view, 'p-f'), null)).toBe('Mecz #18 · po półfinałach');
  });
});
