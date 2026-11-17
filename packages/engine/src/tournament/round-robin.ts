import { TOURNAMENT_PLAYER_LIMITS } from '@autoscore/schema';
import { EngineError } from '../errors.js';

export type RoundRobinPair = readonly [string, string];
export type RoundRobinRound = readonly RoundRobinPair[];

// Metoda kołowa dla m (n zaokrąglone w górę do parzystej) pozycji. Pozycja R = m - 1 stoi w miejscu.
// Przy nieparzystym n nie ma na niej gracza, więc para z nią odpada, a jej drugi gracz pauzuje.
function canonicalRounds(order: readonly string[]): RoundRobinRound[] {
  const fixed = order.length % 2 === 0 ? order.length - 1 : order.length;
  const rounds: RoundRobinRound[] = [];
  for (let r = 0; r < fixed; r++) {
    const c = (fixed - r) % fixed;
    const pairs: RoundRobinPair[] = [];
    for (const [i, first] of order.entries()) {
      for (const [j, second] of order.entries()) {
        const meets = j === fixed ? (2 * i) % fixed === c : (i + j) % fixed === c;
        if (i < j && meets) {
          pairs.push([first, second]);
        }
      }
    }
    rounds.push(pairs);
  }
  return rounds;
}

// Permutacje w porządku leksykograficznym względem kolejności wejściowej, więc wejściowa jest pierwsza.
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [[...items]];
  }
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

function players(pairs: readonly RoundRobinPair[]): readonly string[] {
  return pairs.flat();
}

// Mecze jednej rundy nie mają wspólnych graczy, więc sprawdzamy tylko styk dwóch kolejnych rund.
function searchPlayOrder(rounds: readonly RoundRobinRound[]): RoundRobinRound[] | null {
  const used = rounds.map(() => false);
  const chosen: RoundRobinRound[] = [];
  const visit = (previous: readonly string[]): boolean => {
    if (chosen.length === rounds.length) {
      return true;
    }
    for (const [index, round] of rounds.entries()) {
      if (used[index]) {
        continue;
      }
      for (const candidate of permutations(round)) {
        if (players(candidate.slice(0, 1)).some((id) => previous.includes(id))) {
          continue;
        }
        used[index] = true;
        chosen.push(candidate);
        if (visit(players(candidate.slice(-1)))) {
          return true;
        }
        chosen.pop();
        used[index] = false;
      }
    }
    return false;
  };
  return visit([]) ? chosen : null;
}

export function roundRobinRounds(order: readonly string[]): readonly RoundRobinRound[] {
  const { min, max } = TOURNAMENT_PLAYER_LIMITS.league;
  if (order.length < min || order.length > max) {
    throw new EngineError('invalid_config', `A round robin needs ${min} to ${max} players`);
  }
  if (order.some((id) => !id) || new Set(order).size !== order.length) {
    throw new EngineError('invalid_config', 'Player ids must be non-empty and distinct');
  }
  const rounds = canonicalRounds(order);
  // Dla 3 i 4 graczy mecz pod rząd jest nie do uniknięcia i zostaje kolejność kanoniczna.
  return searchPlayOrder(rounds) ?? rounds;
}
