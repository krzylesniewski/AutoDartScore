import type { Hit } from '@autoscore/schema';

export function hitPoints(hit: Hit): number {
  return hit.segment * hit.multiplier;
}

// Double-out: zamknąć można doublem albo Bullem (25 × 2).
export function isDouble(hit: Hit): boolean {
  return hit.multiplier === 2;
}

// Bust: poniżej zera, dokładnie 1 albo zero bez doubla. Wynik wraca do stanu sprzed tury, tura się kończy.
export function isBust(after: number, hit: Hit): boolean {
  return after < 0 || after === 1 || (after === 0 && !isDouble(hit));
}
