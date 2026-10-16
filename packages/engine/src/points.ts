import type { Hit } from '@autoscore/schema';

export function hitPoints(hit: Hit): number {
  return hit.segment * hit.multiplier;
}

// Double-out: zamknąć można doublem albo Bullem (25 × 2).
export function isDouble(hit: Hit): boolean {
  return hit.multiplier === 2;
}
