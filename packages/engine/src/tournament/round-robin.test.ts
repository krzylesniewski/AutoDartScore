import { describe, expect, it } from 'vitest';
import { EngineError } from '../errors.js';
import { roundRobinRounds } from './round-robin.js';

const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const SIZES = [3, 4, 5, 6, 7, 8, 9, 10];

function players(n: number): string[] {
  return IDS.slice(0, n);
}

// Para jako tekst "a-b", rundy rozdzielone "|", żeby wektory z briefu dało się porównać jednym napisem.
function describeRounds(rounds: readonly (readonly (readonly [string, string])[])[]): string {
  return rounds.map((round) => round.map(([x, y]) => `${x}-${y}`).join(', ')).join(' | ');
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

describe('roundRobinRounds vectors', () => {
  it('3 players: one match per round, back to back is unavoidable', () => {
    expect(describeRounds(roundRobinRounds(players(3)))).toBe('b-c | a-c | a-b');
  });

  it('4 players: canonical order', () => {
    expect(describeRounds(roundRobinRounds(players(4)))).toBe('a-d, b-c | a-c, b-d | a-b, c-d');
  });

  it('5 players: reordered so nobody plays twice in a row', () => {
    const rounds = roundRobinRounds(players(5));
    expect(describeRounds(rounds)).toBe('b-e, c-d | a-e, b-d | a-c, d-e | b-c, a-d | c-e, a-b');
    const resting = rounds.map((round) => players(5).find((id) => !round.flat().includes(id)));
    expect(resting).toEqual(['a', 'c', 'b', 'e', 'd']);
  });

  it('6 players: the mockup schedule, 15 matches in order', () => {
    const rounds = roundRobinRounds(players(6));
    expect(rounds).toEqual([
      [
        ['a', 'f'],
        ['b', 'e'],
        ['c', 'd'],
      ],
      [
        ['a', 'e'],
        ['b', 'd'],
        ['c', 'f'],
      ],
      [
        ['a', 'd'],
        ['b', 'c'],
        ['e', 'f'],
      ],
      [
        ['a', 'c'],
        ['b', 'f'],
        ['d', 'e'],
      ],
      [
        ['a', 'b'],
        ['c', 'e'],
        ['d', 'f'],
      ],
    ]);
    expect(rounds.flat()).toHaveLength(15);
  });
});

describe.each(SIZES)('roundRobinRounds with %i players', (n) => {
  const order = players(n);
  const rounds = roundRobinRounds(order);
  const matches = rounds.flat();

  it('plays every pair exactly once', () => {
    expect(matches).toHaveLength((n * (n - 1)) / 2);
    const keys = matches.map((pair) => [...pair].sort().join('-'));
    expect(new Set(keys).size).toBe(keys.length);
    for (const [i, first] of order.entries()) {
      for (const second of order.slice(i + 1)) {
        expect(keys).toContain(`${first}-${second}`);
      }
    }
  });

  it('has each player at most once per round', () => {
    for (const round of rounds) {
      const ids = round.flat();
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has n - 1 rounds for even n and n rounds for odd n', () => {
    expect(rounds).toHaveLength(n % 2 === 0 ? n - 1 : n);
  });
});

describe.each(SIZES.filter((n) => n % 2 === 1))('roundRobinRounds with an odd count of %i players', (n) => {
  it('rests exactly one player per round and each player exactly once', () => {
    const order = players(n);
    const resting = roundRobinRounds(order).map((round) => order.filter((id) => !round.flat().includes(id)));
    for (const rest of resting) {
      expect(rest).toHaveLength(1);
    }
    expect(resting.flat().sort()).toEqual([...order].sort());
  });
});

describe.each(SIZES.filter((n) => n >= 5))('roundRobinRounds play order with %i players', (n) => {
  it('never has a player in two consecutive matches', () => {
    const matches = roundRobinRounds(players(n)).flat();
    for (const [index, pair] of matches.entries()) {
      const next = matches[index + 1];
      if (next) {
        expect(pair.some((id) => next.includes(id))).toBe(false);
      }
    }
  });
});

describe.each(SIZES.filter((n) => n >= 6))('roundRobinRounds canonical order with %i players', (n) => {
  const order = players(n);
  const rounds = roundRobinRounds(order);

  it('keeps the canonical circle order unchanged', () => {
    const fixed = n % 2 === 0 ? n - 1 : n;
    for (const [r, round] of rounds.entries()) {
      const c = (fixed - r) % fixed;
      const lower = round.map(([x]) => order.indexOf(x));
      expect(lower).toEqual([...lower].sort((x, y) => x - y));
      for (const [x, y] of round) {
        const i = order.indexOf(x);
        const j = order.indexOf(y);
        expect(i).toBeLessThan(j);
        expect(j === fixed ? (2 * i) % fixed : (i + j) % fixed).toBe(c);
      }
    }
  });
});

describe('roundRobinRounds rejects', () => {
  it('2 players', () => {
    expectEngineError(() => roundRobinRounds(players(2)), 'invalid_config');
  });

  it('11 players', () => {
    expectEngineError(() => roundRobinRounds([...IDS, 'k']), 'invalid_config');
  });

  it('a duplicate id', () => {
    expectEngineError(() => roundRobinRounds(['a', 'b', 'a']), 'invalid_config');
  });

  it('an empty id', () => {
    expectEngineError(() => roundRobinRounds(['a', '', 'c']), 'invalid_config');
  });
});
