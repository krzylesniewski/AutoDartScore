import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  applyCasualThrow,
  createCasualMatch,
  currentRound,
  EngineError,
  replayCasualMatch,
  type CasualMatchConfig,
  type CasualMatchState,
} from './index.js';

const S = (n: number): Hit => ({ segment: n, multiplier: 1 }) as Hit;
const D = (n: number): Hit => ({ segment: n, multiplier: 2 }) as Hit;
const T = (n: number): Hit => ({ segment: n, multiplier: 3 }) as Hit;
const BULL: Hit = { segment: 25, multiplier: 2 };
const OUTER_BULL: Hit = { segment: 25, multiplier: 1 };
const MISS: Hit = { segment: 0, multiplier: 0 };

const config: CasualMatchConfig = { playerIds: ['anna', 'bartek', 'celina'], startingScore: 301, firstPlayerIndex: 0 };
const fourPlayers: CasualMatchConfig = { ...config, playerIds: ['anna', 'bartek', 'celina', 'daria'] };

// Stan w trakcie gry z zadanymi wynikami (wygodniejsze niż rozgrywanie całego lega).
function midGame(
  scores: Pick<CasualMatchState, 'remaining' | 'turnStartRemaining' | 'currentPlayerIndex'>,
  base: CasualMatchState = createCasualMatch(config),
): CasualMatchState {
  return { ...base, ...scores };
}

function thrower(state: CasualMatchState) {
  return state.config.playerIds[state.currentPlayerIndex];
}

function throwAll(state: CasualMatchState, hits: readonly Hit[]) {
  let current = state;
  const events = [];
  for (const hit of hits) {
    const result = applyCasualThrow(current, hit);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
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

describe('createCasualMatch', () => {
  it('starts every player at the starting score with the drawn player throwing first', () => {
    const state = createCasualMatch({ ...fourPlayers, startingScore: 701, firstPlayerIndex: 2 });
    expect(state.remaining).toEqual([701, 701, 701, 701]);
    expect(state.turnStartRemaining).toBe(701);
    expect(thrower(state)).toBe('celina');
    expect(state.turnIndex).toBe(0);
    expect(state.dartsThrownInLeg).toEqual([0, 0, 0, 0]);
    expect(state.placements).toEqual([]);
    expect(state.finished).toBe(false);
  });

  it.each([301, 501, 701] as const)('accepts starting score %i', (startingScore) => {
    expect(createCasualMatch({ ...config, startingScore }).remaining).toEqual([startingScore, startingScore, startingScore]);
  });

  it('accepts two players', () => {
    expect(createCasualMatch({ ...config, playerIds: ['anna', 'bartek'] }).remaining).toEqual([301, 301]);
  });

  it.each([
    ['one player', { ...config, playerIds: ['anna'] }],
    ['five players', { ...config, playerIds: ['anna', 'bartek', 'celina', 'daria', 'emil'] }],
    ['an empty player id', { ...config, playerIds: ['anna', '', 'celina'] }],
    ['the same player twice', { ...config, playerIds: ['anna', 'bartek', 'anna'] }],
    ['an unsupported starting score', { ...config, startingScore: 401 as 501 }],
    ['a negative firstPlayerIndex', { ...config, firstPlayerIndex: -1 }],
    ['a firstPlayerIndex out of range', { ...config, firstPlayerIndex: 3 }],
    ['a fractional firstPlayerIndex', { ...config, firstPlayerIndex: 0.5 }],
  ])('rejects %s', (_name, invalid: CasualMatchConfig) => {
    expectEngineError(() => createCasualMatch(invalid), 'invalid_config');
  });
});

describe('turns', () => {
  it('completes a turn after three darts and passes the throw to the next player', () => {
    const { state, events } = throwAll(createCasualMatch(config), [T(20), T(20), T(20)]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [T(20), T(20), T(20)], total: 180, remaining: 121 },
    ]);
    expect(thrower(state)).toBe('bartek');
    expect(state.turnIndex).toBe(1);
    expect(state.turnStartRemaining).toBe(301);
    expect(state.currentDarts).toEqual([]);
  });

  it('wraps around from the last player to the first', () => {
    const { state, events } = throwAll(createCasualMatch({ ...config, firstPlayerIndex: 2 }), [S(1), S(1), S(1)]);
    expect(events[0]).toMatchObject({ type: 'turn_completed', playerId: 'celina' });
    expect(thrower(state)).toBe('anna');
  });

  it('gives a fourth dart to the next player, never to the same turn', () => {
    const { state, events } = throwAll(createCasualMatch(config), [S(1), S(1), S(1), S(5)]);
    expect(state.remaining).toEqual([298, 296, 301]);
    expect(thrower(state)).toBe('bartek');
    expect(state.currentDarts).toEqual([S(5)]);
    expect(events).toHaveLength(1);
  });

  it('counts a miss as a thrown dart worth zero', () => {
    const { state, events } = throwAll(createCasualMatch(config), [MISS, MISS, MISS]);
    expect(events[0]).toMatchObject({ type: 'turn_completed', total: 0, remaining: 301 });
    expect(state.dartsThrownInLeg).toEqual([3, 0, 0]);
  });

  it('rejects an impossible hit', () => {
    expectEngineError(() => applyCasualThrow(createCasualMatch(config), { segment: 25, multiplier: 3 } as unknown as Hit), 'invalid_hit');
  });
});

describe('bust', () => {
  it.each([
    ['going below zero', 40, [T(20)]],
    ['leaving exactly 1', 41, [D(20)]],
    ['reaching zero without a double', 40, [S(20), S(20)]],
    ['reaching zero with Outer Bull', 25, [OUTER_BULL]],
  ] as const)('busts when %s', (_name, score, hits) => {
    const { state, events } = throwAll(midGame({ remaining: [score, 301, 301], turnStartRemaining: score, currentPlayerIndex: 0 }), hits);
    expect(events).toEqual([{ type: 'bust', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [...hits], remaining: score }]);
    expect(state.remaining[0]).toBe(score);
    expect(state.dartsThrownInLeg[0]).toBe(hits.length);
    expect(state.currentDarts).toEqual([]);
    expect(thrower(state)).toBe('bartek');
  });
});

describe('checkout', () => {
  it('finishes with Bull on the first dart of a turn', () => {
    const { state, events } = applyCasualThrow(midGame({ remaining: [301, 50, 301], turnStartRemaining: 50, currentPlayerIndex: 1 }), BULL);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'bartek', legIndex: 0, turnIndex: 0, darts: [BULL], total: 50, remaining: 0 },
      { type: 'player_finished', playerId: 'bartek', legIndex: 0, place: 1, checkout: 50, dartsThrown: 1 },
    ]);
    expect(state.placements).toEqual([{ playerId: 'bartek', place: 1 }]);
    expect(state.remaining).toEqual([301, 0, 301]);
    expect(thrower(state)).toBe('celina');
    expect(state.finished).toBe(false);
  });

  it('ends a two-player game at the first checkout', () => {
    const twoPlayers = createCasualMatch({ ...config, playerIds: ['anna', 'bartek'] });
    const { state, events } = throwAll(midGame({ remaining: [60, 301], turnStartRemaining: 60, currentPlayerIndex: 0 }, twoPlayers), [S(20), D(20)]);
    expect(events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [S(20), D(20)], total: 60, remaining: 0 },
      { type: 'player_finished', playerId: 'anna', legIndex: 0, place: 1, checkout: 60, dartsThrown: 2 },
      {
        type: 'casual_finished',
        placements: [
          { playerId: 'anna', place: 1 },
          { playerId: 'bartek', place: 2 },
        ],
      },
    ]);
    expect(state.finished).toBe(true);
    expect(state.currentDarts).toEqual([]);
  });

  it('ranks consecutive checkouts in a four-player game and gives the last player the last place', () => {
    const start = midGame({ remaining: [40, 50, 32, 100], turnStartRemaining: 50, currentPlayerIndex: 1 }, createCasualMatch(fourPlayers));
    // bartek i celina kończą jeden po drugim, daria pudłuje, anna kończy jako trzecia.
    const { state, events } = throwAll(start, [BULL, D(16), MISS, MISS, MISS, D(20)]);
    expect(events.map((event) => event.type)).toEqual([
      'turn_completed',
      'player_finished',
      'turn_completed',
      'player_finished',
      'turn_completed',
      'turn_completed',
      'player_finished',
      'casual_finished',
    ]);
    expect(events.filter((event) => event.type === 'player_finished').map((event) => [event.playerId, event.place])).toEqual([
      ['bartek', 1],
      ['celina', 2],
      ['anna', 3],
    ]);
    const placements = [
      { playerId: 'bartek', place: 1 },
      { playerId: 'celina', place: 2 },
      { playerId: 'anna', place: 3 },
      { playerId: 'daria', place: 4 },
    ];
    expect(events.at(-1)).toEqual({ type: 'casual_finished', placements });
    expect(state.placements).toEqual(placements);
    expect(state.remaining).toEqual([0, 0, 0, 100]);
    expect(state.finished).toBe(true);
  });

  it('rejects a dart after the game has finished before validating the hit', () => {
    const twoPlayers = createCasualMatch({ ...config, playerIds: ['anna', 'bartek'] });
    const { state } = applyCasualThrow(midGame({ remaining: [40, 301], turnStartRemaining: 40, currentPlayerIndex: 0 }, twoPlayers), D(20));
    expectEngineError(() => applyCasualThrow(state, { segment: 25, multiplier: 3 } as unknown as Hit), 'match_finished');
  });
});

describe('reference game: three players, two checkouts', () => {
  const start = () => midGame({ remaining: [40, 32, 100], turnStartRemaining: 40, currentPlayerIndex: 0 });
  const annaOut = [D(20)];
  const bartekBusts = [S(20), S(10), S(1)];
  const celinaMisses = [MISS, MISS, MISS];
  const bartekOut = [D(16)];
  const hits = [...annaOut, ...bartekBusts, ...celinaMisses, ...bartekOut];

  it('ranks players by checkout and skips finished players', () => {
    const annaTurn = throwAll(start(), annaOut);
    expect(annaTurn.events).toEqual([
      { type: 'turn_completed', playerId: 'anna', legIndex: 0, turnIndex: 0, darts: [D(20)], total: 40, remaining: 0 },
      { type: 'player_finished', playerId: 'anna', legIndex: 0, place: 1, checkout: 40, dartsThrown: 1 },
    ]);
    expect(thrower(annaTurn.state)).toBe('bartek');

    const bartekBust = throwAll(annaTurn.state, bartekBusts);
    expect(bartekBust.events).toEqual([
      { type: 'bust', playerId: 'bartek', legIndex: 0, turnIndex: 1, darts: [S(20), S(10), S(1)], remaining: 32 },
    ]);
    expect(bartekBust.state.remaining).toEqual([0, 32, 100]);
    expect(thrower(bartekBust.state)).toBe('celina');

    const celinaTurn = throwAll(bartekBust.state, celinaMisses);
    expect(celinaTurn.events).toEqual([
      { type: 'turn_completed', playerId: 'celina', legIndex: 0, turnIndex: 2, darts: [MISS, MISS, MISS], total: 0, remaining: 100 },
    ]);
    expect(thrower(celinaTurn.state)).toBe('bartek');

    const bartekTurn = throwAll(celinaTurn.state, bartekOut);
    expect(bartekTurn.events).toEqual([
      { type: 'turn_completed', playerId: 'bartek', legIndex: 0, turnIndex: 3, darts: [D(16)], total: 32, remaining: 0 },
      { type: 'player_finished', playerId: 'bartek', legIndex: 0, place: 2, checkout: 32, dartsThrown: 4 },
      {
        type: 'casual_finished',
        placements: [
          { playerId: 'anna', place: 1 },
          { playerId: 'bartek', place: 2 },
          { playerId: 'celina', place: 3 },
        ],
      },
    ]);
    expect(bartekTurn.state.finished).toBe(true);
    expect(bartekTurn.state.currentDarts).toEqual([]);
  });

  it('rejects a dart thrown after the game has finished', () => {
    const { state } = throwAll(start(), hits);
    expectEngineError(() => applyCasualThrow(state, S(20)), 'match_finished');
  });

  it('undo is a replay without the last dart', () => {
    const { state } = throwAll(start(), hits.slice(0, -1));
    expect(state.finished).toBe(false);
    expect(thrower(state)).toBe('bartek');
    expect(state.turnStartRemaining).toBe(32);
    expect(state.remaining).toEqual([0, 32, 100]);
    expect(state.placements).toEqual([{ playerId: 'anna', place: 1 }]);
  });
});

describe('replay', () => {
  it('produces the same state and events as applying throws one by one', () => {
    // anna kończy w drugiej turze (180, potem 121), bartek i celina grają dalej.
    const hits = [T(20), T(20), T(20), MISS, MISS, MISS, S(1), S(1), S(1), T(20), T(17), D(5), T(20), S(5)];
    const replayed = replayCasualMatch(config, hits);
    const stepwise = throwAll(createCasualMatch(config), hits);
    expect(replayed).toEqual(stepwise);
    expect(replayed.state.placements).toEqual([{ playerId: 'anna', place: 1 }]);
    expect(thrower(replayed.state)).toBe('bartek');
  });

  it('does not mutate the previous state', () => {
    const start = midGame({ remaining: [40, 32, 100], turnStartRemaining: 40, currentPlayerIndex: 0 });
    const snapshot = structuredClone(start);
    applyCasualThrow(start, D(20));
    expect(start).toEqual(snapshot);
  });
});

describe('round in the leg', () => {
  const round = (state: CasualMatchState) => currentRound({ type: 'casual', state });
  const turn = [S(1), S(1), S(1)];

  it('lets a player finish in round 3 and drop out while the others share round 3 and then round 4', () => {
    const twoRounds = throwAll(createCasualMatch(config), [...turn, ...turn, ...turn, ...turn, ...turn, ...turn]).state;
    expect(twoRounds.turnsInLeg).toEqual([2, 2, 2]);
    const annaReady = { ...twoRounds, remaining: [40, ...twoRounds.remaining.slice(1)], turnStartRemaining: 40 };
    expect(thrower(annaReady)).toBe('anna');
    expect(round(annaReady)).toBe(3);

    const annaOut = applyCasualThrow(annaReady, D(20)).state;
    expect(annaOut.placements).toEqual([{ playerId: 'anna', place: 1 }]);
    expect(annaOut.turnsInLeg).toEqual([3, 2, 2]);
    expect(thrower(annaOut)).toBe('bartek');
    expect(round(annaOut)).toBe(3);

    const bartekDone = throwAll(annaOut, turn).state;
    expect(thrower(bartekDone)).toBe('celina');
    expect(round(bartekDone)).toBe(3);

    const celinaDone = throwAll(bartekDone, turn).state;
    expect(thrower(celinaDone)).toBe('bartek');
    expect(round(celinaDone)).toBe(4);
    expect(celinaDone.turnsInLeg).toEqual([3, 3, 3]);
  });

  it('counts a bust while others have already finished', () => {
    const start = midGame({ remaining: [40, 32, 100], turnStartRemaining: 40, currentPlayerIndex: 0 });
    const bartekBust = throwAll(start, [D(20), S(20), S(10), S(1)]).state;
    expect(bartekBust.turnsInLeg).toEqual([1, 1, 0]);
    expect(thrower(bartekBust)).toBe('celina');
    expect(round(bartekBust)).toBe(1);
    expect(round(throwAll(bartekBust, turn).state)).toBe(2);
  });

  it('has no round once the game is finished', () => {
    const twoPlayers = createCasualMatch({ ...config, playerIds: ['anna', 'bartek'] });
    const finished = applyCasualThrow(midGame({ remaining: [40, 301], turnStartRemaining: 40, currentPlayerIndex: 0 }, twoPlayers), D(20)).state;
    expect(finished.finished).toBe(true);
    expect(round(finished)).toBeNull();
  });
});
