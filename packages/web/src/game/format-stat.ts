import type { PlayerStatLine } from '@autoscore/schema';
import { pl } from '../i18n/pl';

export const NO_VALUE = '—';

// Kropka dziesiętna, jak licznik Free run w pasku wyników.
export function formatAverage(value: number | null): string {
  return value === null ? NO_VALUE : value.toFixed(2);
}

export function formatNumber(value: number | null): string {
  return value === null ? NO_VALUE : String(value);
}

export function formatDoubles(line: Pick<PlayerStatLine, 'doublesPercent' | 'doublesHit' | 'doubleAttempts'>): string {
  return line.doublesPercent === null ? NO_VALUE : `${line.doublesPercent.toFixed(1)}% (${line.doublesHit}/${line.doubleAttempts})`;
}

export function formatBestLeg(darts: number | null): string {
  return darts === null ? NO_VALUE : pl.darts(darts);
}
