import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { replayGame, type CheckoutStep, type GameConfig } from './index.js';

// Migawka nagrana na silniku sprzed wydzielenia wspólnego rdzenia tury. Każda różnica to zmiana zachowania, więc migawki się nie nadpisuje.

const S = (n: number): Hit => ({ segment: n, multiplier: 1 });
const D = (n: number): Hit => ({ segment: n, multiplier: 2 });
const T = (n: number): Hit => ({ segment: n, multiplier: 3 });
const BULL: Hit = { segment: 25, multiplier: 2 };
const OUTER_BULL: Hit = { segment: 25, multiplier: 1 };
const MISS: Hit = { segment: 0, multiplier: 0 };
const MAX: readonly Hit[] = [T(20), T(20), T(20)];

interface Scenario {
  readonly name: string;
  readonly config: GameConfig;
  readonly hits: readonly Hit[];
  readonly checkoutSteps?: readonly CheckoutStep[];
}

const match: GameConfig = { type: 'match', playerIds: ['anna', 'bartek'], startingScore: 301, legsToWin: 2, firstPlayerIndex: 1 };

// Leg 0 zaczyna bartek, leg 1 anna, leg 2 znowu bartek.
const matchTurns: readonly (readonly Hit[])[] = [
  MAX, // bartek 121
  MAX, // anna 121
  [T(20), T(20)], // bartek: zostałaby 1, bust
  [T(20), OUTER_BULL, MISS], // anna 36
  [T(20), T(19), S(5)], // bartek: poniżej zera, bust
  [D(18)], // anna: zamknięcie pierwszą rzutką, leg 0
  MAX, // anna 121
  MAX, // bartek 121
  [T(20), T(19), S(4)], // anna: zero bez doubla, bust
  [T(20), S(11), BULL], // bartek: zamknięcie na Bullu, leg 1
  MAX, // bartek 121
  MAX, // anna 121
  [S(1), S(1), S(1)], // bartek 118
  [S(20), S(1), S(20)], // anna 80
  [S(1), S(1), S(1)], // bartek 115
  [T(20), D(10)], // anna: zamknięcie drugą rzutką, leg 2 i mecz
];

const casual4: GameConfig = { type: 'casual', playerIds: ['ola', 'piotr', 'rafal', 'sara'], startingScore: 301, firstPlayerIndex: 2 };

// Kolejność: rafal, sara, ola, piotr.
const casual4Turns: readonly (readonly Hit[])[] = [
  MAX,
  MAX,
  MAX,
  MAX,
  [T(20), S(11), BULL], // rafal: 1. miejsce
  [T(20), T(20)], // sara: zostałaby 1, bust
  [T(20), T(19), D(2)], // ola: 2. miejsce
  [T(20), S(1), S(20)], // piotr 40
  [S(20), T(20), T(20)], // sara: poniżej zera po zamknięciu dwóch graczy, bust
  [S(20), D(10)], // piotr: 3. miejsce, sara ostatnia
];

const casual3: GameConfig = { type: 'casual', playerIds: ['ola', 'piotr', 'rafal'], startingScore: 301, firstPlayerIndex: 0 };

const solo: GameConfig = { type: 'practice', practiceMode: 'solo_501', playerId: 'sam' };

const soloTurns: readonly (readonly Hit[])[] = [
  MAX, // 321
  MAX, // 141
  [T(20), T(20), S(20)], // zostałaby 1, bust
  [T(20), T(19), D(12)], // zamknięcie
];

const steps: readonly CheckoutStep[] = [
  { type: 'attempt', success: false },
  { type: 'attempt', success: false },
  { type: 'attempt', success: true },
  { type: 'skip' },
  { type: 'attempt', success: true },
  { type: 'attempt', success: false },
  { type: 'skip' },
  { type: 'skip' },
  { type: 'attempt', success: false },
  { type: 'attempt', success: true },
];

const scenarios: readonly Scenario[] = [
  { name: '1v1 full match', config: match, hits: matchTurns.flat() },
  { name: '1v1 stopped with one dart open', config: match, hits: [...matchTurns.slice(0, 12).flat(), S(1)] },
  { name: '1v1 stopped with two darts open', config: match, hits: [...matchTurns.slice(0, 13).flat(), S(20), S(1)] },
  { name: 'casual with 4 players to the end', config: casual4, hits: casual4Turns.flat() },
  {
    name: 'casual with 3 players stopped mid-turn after one finished',
    config: casual3,
    hits: [
      ...MAX,
      ...MAX,
      ...MAX,
      ...[T(20), S(11), BULL], // ola: 1. miejsce
      ...[S(20), S(20), S(20)], // piotr 61
      ...[S(1), S(1)], // rafal: dwie rzutki otwartej tury
    ],
  },
  { name: 'solo 501 to the checkout', config: solo, hits: soloTurns.flat() },
  { name: 'solo 501 stopped mid-turn', config: solo, hits: [...MAX, T(20), MISS] },
  {
    name: 'free run',
    config: { type: 'practice', practiceMode: 'free_run', playerId: 'sam' },
    hits: [T(20), MISS, BULL, OUTER_BULL, S(5), D(16), T(19)],
  },
  {
    name: 'checkouts repeat_on_miss',
    config: { type: 'practice', practiceMode: 'checkouts', playerId: 'sam', range: '2-50', seed: 12345, rule: 'repeat_on_miss' },
    hits: [],
    checkoutSteps: steps,
  },
  {
    name: 'checkouts new_each_attempt',
    config: { type: 'practice', practiceMode: 'checkouts', playerId: 'sam', range: '51-100', seed: 987654321, rule: 'new_each_attempt' },
    hits: [],
    checkoutSteps: steps,
  },
];

describe('replayGame golden snapshots', () => {
  for (const scenario of scenarios) {
    it(scenario.name, () => {
      expect(replayGame(scenario.config, scenario.hits, scenario.checkoutSteps)).toMatchSnapshot();
    });
  }
});
