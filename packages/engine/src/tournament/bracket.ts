import type { BracketRound } from '@autoscore/schema';

// Źródło slotu w pierwszej rundzie drabinki albo zwycięzca meczu z poprzedniej rundy.
export type BracketSource =
  { readonly kind: 'seed'; readonly seed: number } | { readonly kind: 'bye' } | { readonly kind: 'winner_of'; readonly fixtureId: string };

export interface BracketNode {
  readonly id: string;
  readonly round: number;
  readonly bracketRound: BracketRound;
  readonly sources: readonly [BracketSource, BracketSource];
}

export function bracketSize(entrants: number): number {
  let size = 2;
  while (size < entrants) {
    size *= 2;
  }
  return size;
}

// Rozstawienie standardowe: najwyżej rozstawieni spotykają się jak najpóźniej, a wolne losy nigdy nie trafiają na siebie.
export function bracketSeeds(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const mirror = seeds.length * 2 + 1;
    seeds = seeds.flatMap((seed) => [seed, mirror - seed]);
  }
  return seeds;
}

function bracketRoundOf(players: number): BracketRound {
  if (players === 2) {
    return 'final';
  }
  if (players === 4) {
    return 'sf';
  }
  return players === 8 ? 'qf' : 'r16';
}

// Rundy drabinki od pierwszej do finału. Rozstawienia powyżej liczby uczestników to wolne losy.
export function buildBracket(prefix: string, entrants: number): BracketNode[][] {
  const size = bracketSize(entrants);
  let sources: BracketSource[] = bracketSeeds(size).map((seed) => (seed > entrants ? { kind: 'bye' } : { kind: 'seed', seed }));
  const rounds: BracketNode[][] = [];
  while (sources.length >= 2) {
    const bracketRound = bracketRoundOf(sources.length);
    const round = rounds.length + 1;
    const nodes: BracketNode[] = [];
    for (let index = 0; index < sources.length; index += 2) {
      nodes.push({
        id: bracketRound === 'final' ? `${prefix}-f` : `${prefix}-${bracketRound}-${index / 2 + 1}`,
        round,
        bracketRound,
        sources: [sources[index] as BracketSource, sources[index + 1] as BracketSource],
      });
    }
    rounds.push(nodes);
    sources = nodes.map((node) => ({ kind: 'winner_of', fixtureId: node.id }));
  }
  return rounds;
}
