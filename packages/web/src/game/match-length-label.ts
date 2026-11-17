import { BestOf } from '@autoscore/schema';
import { pl } from '../i18n/pl';

// Długości z kreatora (best of 1, 3, 5) zostają w znanej formie, pozostałe pokazujemy jako „Do N legów”.
export function matchLengthLabel(legsToWin: number): string {
  const bestOf = legsToWin * 2 - 1;
  return BestOf.safeParse(bestOf).success ? pl.bestOfOption(bestOf) : pl.firstToLegs(legsToWin);
}
