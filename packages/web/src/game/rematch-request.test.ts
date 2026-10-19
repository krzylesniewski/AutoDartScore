import { describe, expect, it } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { rematchRequest } from './rematch-request';

describe('rematchRequest', () => {
  it('keeps 501 and turns two legs to win into best of 3', () => {
    expect(rematchRequest(snapshot({ startingScore: 501, legsToWin: 2 }))).toEqual({ type: 'match', playerIds: ['p1', 'p2'], startingScore: 501, bestOf: 3 });
  });

  it('turns three legs to win into best of 5', () => {
    expect(rematchRequest(snapshot({ startingScore: 701, legsToWin: 3 }))).toEqual({ type: 'match', playerIds: ['p1', 'p2'], startingScore: 701, bestOf: 5 });
  });

  it('turns one leg to win into best of 1', () => {
    expect(rematchRequest(snapshot({ startingScore: 301, legsToWin: 1 }))).toEqual({ type: 'match', playerIds: ['p1', 'p2'], startingScore: 301, bestOf: 1 });
  });

  it('keeps the player order of the finished match', () => {
    const state = snapshot({ players: [player('p2', 'Bartek'), player('p1', 'Anna')] });
    expect(rematchRequest(state)?.playerIds).toEqual(['p2', 'p1']);
  });

  it('gives null for a casual game', () => {
    expect(rematchRequest(casual(['Anna', 'Bartek', 'Celina']))).toBeNull();
  });

  it('gives null for a Solo 501 practice', () => {
    expect(rematchRequest(snapshot({ type: 'practice', practiceMode: 'solo_501', legsToWin: null, players: [player('p1', 'Anna')] }))).toBeNull();
  });

  it('gives null for a match without legsToWin', () => {
    expect(rematchRequest(snapshot({ legsToWin: null }))).toBeNull();
  });
});
