import { hitPoints } from '@autoscore/engine';
import type { Hit } from '@autoscore/schema';

type Scoring = Hit & { points: number };

function dart(segment: Hit['segment'], multiplier: Hit['multiplier']): Scoring {
  const hit = { segment, multiplier } as Hit;
  return { ...hit, points: hitPoints(hit) };
}

const SEGMENTS_DESC = Array.from({ length: 20 }, (_, index) => (20 - index) as Hit['segment']);

// Kolejność ustalona, żeby podpowiedź była zawsze ta sama. Pierwsza pasująca trasa wygrywa.
const FINISHING: readonly Scoring[] = [
  ...[20, 16, 18, 12, 10, 8, 14, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1].map((segment) => dart(segment as Hit['segment'], 2)),
  dart(25, 2),
];

const SETUP: readonly Scoring[] = [
  ...SEGMENTS_DESC.map((segment) => dart(segment, 3)),
  dart(25, 2),
  dart(25, 1),
  ...SEGMENTS_DESC.map((segment) => dart(segment, 1)),
  ...SEGMENTS_DESC.map((segment) => dart(segment, 2)),
];

const MAX_CHECKOUT = 170;
const MAX_DART = 60;

function route(remaining: number, setupDarts: number): Scoring[] | null {
  for (const finish of FINISHING) {
    const setup = setupFor(remaining - finish.points, setupDarts);
    if (setup) {
      return [...setup, finish];
    }
  }
  return null;
}

function setupFor(points: number, darts: number): Scoring[] | null {
  if (darts === 0) {
    return points === 0 ? [] : null;
  }
  if (points < darts || points > darts * MAX_DART) {
    return null;
  }
  for (const first of SETUP) {
    const rest = setupFor(points - first.points, darts - 1);
    if (rest) {
      return [first, ...rest];
    }
  }
  return null;
}

// Tylko podpowiedź na ekranie. O wyniku decyduje serwer.
export function suggestCheckout(remaining: number, dartsLeft: 1 | 2 | 3): Hit[] | null {
  if (remaining < 2 || remaining > MAX_CHECKOUT) {
    return null;
  }
  for (let darts = 1; darts <= dartsLeft; darts++) {
    const found = route(remaining, darts - 1);
    if (found) {
      return found.map(({ segment, multiplier }) => ({ segment, multiplier }) as Hit);
    }
  }
  return null;
}
