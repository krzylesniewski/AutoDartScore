import { describe, expect, it } from 'vitest';
import { fixture, tournamentView } from '../test/snapshots';
import { slotPlayer, slotSourceText, slotText } from './tournament-slot';

const view = tournamentView();

describe('slotPlayer and slotText', () => {
  it('finds the player of a player slot', () => {
    expect(slotPlayer(view, { kind: 'player', playerId: 'p2', seed: null })?.name).toBe('Bartek');
    expect(slotText(view, { kind: 'player', playerId: 'p2', seed: null })).toBe('Bartek');
  });

  it('names a bye and a slot without a player yet', () => {
    expect(slotPlayer(view, { kind: 'bye' })).toBeNull();
    expect(slotText(view, { kind: 'bye' })).toBe('Wolny los');
    expect(slotText(view, { kind: 'winner_of', fixtureId: 'p-sf-1' })).toBe('Do ustalenia');
    expect(slotText(view, { kind: 'standing', place: 2 })).toBe('Do ustalenia');
    expect(slotText(view, { kind: 'player', playerId: 'p9', seed: null })).toBe('Do ustalenia');
  });
});

describe('slotSourceText', () => {
  const bracket = tournamentView({
    format: 'cup',
    fixtures: [
      fixture({ id: 'p-r16-5', number: 5, phase: 'playoff', bracketRound: 'r16' }),
      fixture({ id: 'p-qf-3', number: 11, phase: 'playoff', bracketRound: 'qf' }),
      fixture({ id: 'p-sf-2', number: 14, phase: 'playoff', bracketRound: 'sf' }),
      fixture({ id: 'p-f', number: 16, phase: 'playoff', bracketRound: 'final' }),
      fixture({ id: 'c-sf-1', number: 17, phase: 'consolation', bracketRound: 'sf' }),
      fixture({ id: 'c-qf-2', number: 18, phase: 'consolation', bracketRound: 'qf' }),
    ],
  });

  it('shows the player name, or Do ustalenia for an unknown player', () => {
    expect(slotSourceText(bracket, { kind: 'player', playerId: 'p3', seed: 2 })).toBe('Celina');
    expect(slotSourceText(bracket, { kind: 'player', playerId: 'p9', seed: 2 })).toBe('Do ustalenia');
  });

  it('names a bye and a group place', () => {
    expect(slotSourceText(bracket, { kind: 'bye' })).toBe('Wolny los');
    expect(slotSourceText(bracket, { kind: 'standing', place: 3 })).toBe('3. miejsce w grupie');
  });

  it('names the winner or the loser of the source fixture in the genitive', () => {
    expect(slotSourceText(bracket, { kind: 'winner_of', fixtureId: 'p-sf-2' })).toBe('Zwycięzca półfinału 2');
    expect(slotSourceText(bracket, { kind: 'loser_of', fixtureId: 'p-sf-2' })).toBe('Przegrany półfinału 2');
    expect(slotSourceText(bracket, { kind: 'winner_of', fixtureId: 'p-qf-3' })).toBe('Zwycięzca ćwierćfinału 3');
    expect(slotSourceText(bracket, { kind: 'winner_of', fixtureId: 'p-r16-5' })).toBe('Zwycięzca 1/8 finału 5');
    expect(slotSourceText(bracket, { kind: 'loser_of', fixtureId: 'p-f' })).toBe('Przegrany finału');
  });

  it('marks a consolation source', () => {
    expect(slotSourceText(bracket, { kind: 'winner_of', fixtureId: 'c-sf-1' })).toBe('Zwycięzca półfinału 1 (pocieszenie)');
    expect(slotSourceText(bracket, { kind: 'loser_of', fixtureId: 'c-qf-2' })).toBe('Przegrany ćwierćfinału 2 (pocieszenie)');
  });

  it('falls back to Do ustalenia for an unknown source fixture', () => {
    expect(slotSourceText(bracket, { kind: 'winner_of', fixtureId: 'p-sf-9' })).toBe('Do ustalenia');
  });
});
