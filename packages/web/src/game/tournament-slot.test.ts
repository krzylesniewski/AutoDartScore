import { describe, expect, it } from 'vitest';
import { tournamentView } from '../test/snapshots';
import { slotPlayer, slotText } from './tournament-slot';

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
