import { CreateMatchRequest } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { INITIAL_SETUP, changeType, createRequest, pickPlayer } from './game-setup';

describe('game setup', () => {
  it('toggles players up to the limit', () => {
    const two = pickPlayer(pickPlayer(INITIAL_SETUP, 'p1'), 'p2');
    expect(two.playerIds).toEqual(['p1', 'p2']);
    expect(pickPlayer(two, 'p3')).toBe(two);
    expect(pickPlayer(two, 'p1').playerIds).toEqual(['p2']);
  });

  it('replaces the pick when only 1 player is allowed', () => {
    const practice = changeType(INITIAL_SETUP, 'practice');
    expect(pickPlayer(pickPlayer(practice, 'p1'), 'p2').playerIds).toEqual(['p2']);
  });

  it('keeps the earliest picks when the limit shrinks', () => {
    let casual = changeType(INITIAL_SETUP, 'casual');
    for (const id of ['p3', 'p1', 'p2']) {
      casual = pickPlayer(casual, id);
    }
    expect(changeType(casual, 'match').playerIds).toEqual(['p3', 'p1']);
    expect(changeType(casual, 'practice').playerIds).toEqual(['p3']);
  });

  it('builds a request only with the fields of the type', () => {
    const match = { ...INITIAL_SETUP, playerIds: ['p1', 'p2'] };
    expect(createRequest(match)).toEqual({ type: 'match', playerIds: ['p1', 'p2'], startingScore: 501, bestOf: 3 });
    expect(createRequest({ ...match, type: 'casual' })).toEqual({ type: 'casual', playerIds: ['p1', 'p2'], startingScore: 501 });
    expect(createRequest({ ...match, type: 'practice', playerIds: ['p1'] })).toEqual({ type: 'practice', playerIds: ['p1'], practiceMode: 'free_run' });
    expect(CreateMatchRequest.safeParse(createRequest({ ...match, playerIds: ['p1'] })).success).toBe(false);
  });
});
