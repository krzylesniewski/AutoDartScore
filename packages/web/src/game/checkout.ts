import { hitPoints } from '@autoscore/engine';
import type { Hit } from '@autoscore/schema';

type Scoring = Hit & { points: number };

function dart(segment: Hit['segment'], multiplier: Hit['multiplier']): Scoring {
  const hit = { segment, multiplier } as Hit;
  return { ...hit, points: hitPoints(hit) };
}

const SEGMENTS_DESC = Array.from({ length: 20 }, (_, index) => (20 - index) as Hit['segment']);

// Reguły trasy (design/plan-p43-p44.md, sekcja P44), pierwsza rozstrzygająca wygrywa:
// najmniej rzutek, kończący double w kolejności z FINISHING, przygotowanie 1-20 to singiel,
// powyżej 20 trebla, 25, Bull albo double, a w trasie na 3 rzutki najpierw najwyższa trebla.
const FINISHING: readonly Scoring[] = [
  ...[20, 16, 18, 12, 10, 8, 14, 6, 4, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1].map((segment) => dart(segment as Hit['segment'], 2)),
  dart(25, 2),
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

function setupDart(points: number): Scoring | null {
  if (points >= 1 && points <= 20) {
    return dart(points as Hit['segment'], 1);
  }
  if (points === 25) {
    return dart(25, 1);
  }
  if (points === 50) {
    return dart(25, 2);
  }
  if (points > 20 && points <= 60 && points % 3 === 0) {
    return dart((points / 3) as Hit['segment'], 3);
  }
  if (points > 20 && points <= 40 && points % 2 === 0) {
    return dart((points / 2) as Hit['segment'], 2);
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
  if (darts === 1) {
    const only = setupDart(points);
    return only ? [only] : null;
  }
  for (const segment of SEGMENTS_DESC) {
    const first = dart(segment, 3);
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
