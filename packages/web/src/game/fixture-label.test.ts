import type { BracketRound, FixturePhase } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { fixture } from '../test/snapshots';
import { fixtureLabel, fixtureOrdinal, lowerFirst } from './fixture-label';

function bracketFixture(id: string, phase: FixturePhase, bracketRound: BracketRound | null) {
  return fixture({ id, number: 40, phase, bracketRound });
}

describe('fixtureOrdinal', () => {
  it('reads the trailing number of the id or 1 without one', () => {
    expect(fixtureOrdinal('p-sf-2')).toBe(2);
    expect(fixtureOrdinal('p-r16-8')).toBe(8);
    expect(fixtureOrdinal('c-qf-3')).toBe(3);
    expect(fixtureOrdinal('p-f')).toBe(1);
    expect(fixtureOrdinal('p-3rd')).toBe(1);
    expect(fixtureOrdinal('c-f')).toBe(1);
  });
});

describe('fixtureLabel', () => {
  it('names the play-off rounds with the position in the round', () => {
    expect(fixtureLabel('cup', bracketFixture('p-f', 'playoff', 'final'))).toBe('Finał');
    expect(fixtureLabel('cup', bracketFixture('p-sf-2', 'playoff', 'sf'))).toBe('Półfinał 2');
    expect(fixtureLabel('cup', bracketFixture('p-qf-1', 'playoff', 'qf'))).toBe('Ćwierćfinał 1');
    expect(fixtureLabel('cup', bracketFixture('p-r16-3', 'playoff', 'r16'))).toBe('1/8 finału 3');
  });

  it('names the third place match and the consolation', () => {
    expect(fixtureLabel('group_playoff', bracketFixture('p-3rd', 'third_place', null))).toBe('Mecz o 3. miejsce');
    expect(fixtureLabel('group_playoff', bracketFixture('c-f', 'consolation', 'final'))).toBe('Pocieszenie');
    expect(fixtureLabel('group_playoff', bracketFixture('c-sf-1', 'consolation', 'sf'))).toBe('Pocieszenie, półfinał 1');
    expect(fixtureLabel('group_playoff', bracketFixture('c-qf-4', 'consolation', 'qf'))).toBe('Pocieszenie, ćwierćfinał 4');
    expect(fixtureLabel('group_playoff', bracketFixture('c-r16-2', 'consolation', 'r16'))).toBe('Pocieszenie, 1/8 finału 2');
  });

  it('uses the play order number in the group and the league', () => {
    expect(fixtureLabel('group_playoff', fixture({ id: 'g-3', number: 7 }))).toBe('Grupa, mecz 7');
    expect(fixtureLabel('league', fixture({ id: 'g-3', number: 7 }))).toBe('Liga, mecz 7');
  });
});

describe('lowerFirst', () => {
  it('lower-cases only the first letter', () => {
    expect(lowerFirst('Półfinał 2')).toBe('półfinał 2');
    expect(lowerFirst('Mecz o 3. miejsce')).toBe('mecz o 3. miejsce');
    expect(lowerFirst('1/8 finału 3')).toBe('1/8 finału 3');
  });
});
