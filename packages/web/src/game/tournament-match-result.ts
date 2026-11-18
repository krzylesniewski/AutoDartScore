import type { Fixture, FixtureResult, PublicMatch, PublicMatchPlayer } from '@autoscore/schema';

export interface HeaderResult {
  readonly legs: readonly [number, number];
  readonly winnerId: string | null;
  readonly mark: 'corrected' | 'walkover' | null;
  readonly played: readonly [number, number] | null;
}

// Pasuje do MatchSnapshot i do PublicMatch z publicznego API.
type ResultState = Pick<PublicMatch, 'id' | 'winnerId'> & { readonly players: readonly Pick<PublicMatchPlayer, 'id' | 'legsWon'>[] };

function playerIds(state: ResultState): [string, string] {
  return [state.players[0]?.id ?? '', state.players[1]?.id ?? ''];
}

function playedLegs(state: ResultState): [number, number] {
  return [state.players[0]?.legsWon ?? 0, state.players[1]?.legsWon ?? 0];
}

// Legi wyniku turnieju są w kolejności slotów, a ta nie musi się zgadzać z kolejnością graczy w meczu.
function legsOf(fixture: Fixture, result: FixtureResult, playerId: string): number {
  const slot = fixture.slots.findIndex((entry) => entry.kind === 'player' && entry.playerId === playerId);
  return slot === -1 ? 0 : result.legs[slot === 0 ? 0 : 1];
}

// Wynik w nagłówku strony meczu w kolejności graczy meczu. Poprawka i walkower biorą wynik turnieju,
// a rozegrane legi zostają obok, bo log meczu się nie zmienia.
export function headerResult(state: ResultState, fixture: Fixture | undefined): HeaderResult {
  const result = fixture?.result;
  let mark: HeaderResult['mark'] = null;
  if (fixture && result && fixture.status === 'finished' && result.corrected) {
    mark = 'corrected';
  } else if (fixture && result && fixture.status === 'walkover' && fixture.matchId === state.id) {
    mark = 'walkover';
  }
  if (!fixture || !result || mark === null) {
    return { legs: playedLegs(state), winnerId: state.winnerId, mark: null, played: null };
  }
  const [first, second] = playerIds(state);
  return {
    legs: [legsOf(fixture, result, first), legsOf(fixture, result, second)],
    winnerId: result.winnerId,
    mark,
    played: playedLegs(state),
  };
}
