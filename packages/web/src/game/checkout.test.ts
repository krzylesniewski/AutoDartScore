import { hitPoints } from '@autoscore/engine';
import type { Hit } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { suggestCheckout } from './checkout';

const T = (segment: number): Hit => ({ segment, multiplier: 3 });
const D = (segment: number): Hit => ({ segment, multiplier: 2 });
const BULL: Hit = { segment: 25, multiplier: 2 };

// Wszystkie 62 punktujące rzutki: S/D/T 1-20, 25 i Bull.
const SCORING: Hit[] = [
  ...Array.from({ length: 20 }, (_, index) => [1, 2, 3].map((multiplier) => ({ segment: index + 1, multiplier }) as Hit)).flat(),
  { segment: 25, multiplier: 1 },
  BULL,
];
const SCORING_POINTS = [...new Set(SCORING.map(hitPoints))];
const FINISH_POINTS = SCORING.filter((hit) => hit.multiplier === 2).map(hitPoints);

// Najmniejsza liczba rzutek do zamknięcia z double-out, albo null.
function minimalDarts(remaining: number, dartsLeft: number): number | null {
  for (let darts = 1; darts <= dartsLeft; darts++) {
    let reachable = new Set([0]);
    for (let setup = 1; setup < darts; setup++) {
      reachable = new Set([...reachable].flatMap((sum) => SCORING_POINTS.map((points) => sum + points)));
    }
    if (FINISH_POINTS.some((finish) => reachable.has(remaining - finish))) {
      return darts;
    }
  }
  return null;
}

describe('suggestCheckout', () => {
  it.each([
    [170, 3, [T(20), T(20), BULL]],
    [110, 2, [T(20), BULL]],
    [100, 2, [T(20), D(20)]],
    [40, 1, [D(20)]],
    [50, 1, [BULL]],
    [2, 3, [D(1)]],
  ] as const)('suggests a route for %i with %i darts', (remaining, dartsLeft, expected) => {
    expect(suggestCheckout(remaining, dartsLeft)).toEqual(expected);
  });

  it.each([
    [41, 1],
    [99, 2],
    [159, 3],
    [169, 3],
    [171, 3],
    [1, 3],
  ] as const)('returns null for %i with %i darts', (remaining, dartsLeft) => {
    expect(suggestCheckout(remaining, dartsLeft)).toBeNull();
  });

  it('matches a brute-force oracle for every score from 2 to 171', () => {
    for (let remaining = 2; remaining <= 171; remaining++) {
      for (const dartsLeft of [1, 2, 3] as const) {
        const route = suggestCheckout(remaining, dartsLeft);
        const minimal = minimalDarts(remaining, dartsLeft);
        if (minimal === null) {
          expect(route, `${remaining} in ${dartsLeft}`).toBeNull();
          continue;
        }
        expect(route, `${remaining} in ${dartsLeft}`).not.toBeNull();
        expect(route).toHaveLength(minimal);
        expect(route?.reduce((sum, hit) => sum + hitPoints(hit), 0)).toBe(remaining);
        expect(route?.at(-1)?.multiplier).toBe(2);
      }
    }
  });
});
