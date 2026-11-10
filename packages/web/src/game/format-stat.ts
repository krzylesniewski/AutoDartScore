import type { PlayerStatLine } from '@autoscore/schema';
import { pl } from '../i18n/pl';

export const NO_VALUE = '—';

// Polski przecinek dziesiętny. Bez grupowania, bo pl-PL wstawia od 10 000 twardą spację (12 345,60).
const DECIMAL_FORMATS = {
  1: new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }),
  2: new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
} as const;

export function formatDecimal(value: number, digits: 1 | 2): string {
  return DECIMAL_FORMATS[digits].format(value);
}

export function formatAverage(value: number | null): string {
  return value === null ? NO_VALUE : formatDecimal(value, 2);
}

// Minus to U+2212, szerszy od łącznika i równy plusowi.
export function formatDifference(value: number | null): string {
  if (value === null) {
    return NO_VALUE;
  }
  return value >= 0 ? `+${formatDecimal(value, 2)}` : `−${formatDecimal(Math.abs(value), 2)}`;
}

export function formatNumber(value: number | null): string {
  return value === null ? NO_VALUE : String(value);
}

export function formatDoublesParts(line: Pick<PlayerStatLine, 'doublesPercent' | 'doublesHit' | 'doubleAttempts'>): { value: string; detail: string | null } {
  if (line.doublesPercent === null) {
    return { value: NO_VALUE, detail: null };
  }
  return { value: `${formatDecimal(line.doublesPercent, 1)}%`, detail: `(${line.doublesHit}/${line.doubleAttempts})` };
}

export function formatDoubles(line: Pick<PlayerStatLine, 'doublesPercent' | 'doublesHit' | 'doubleAttempts'>): string {
  const { value, detail } = formatDoublesParts(line);
  return detail === null ? value : `${value} ${detail}`;
}

export function formatBestLeg(darts: number | null): string {
  return darts === null ? NO_VALUE : pl.darts(darts);
}
