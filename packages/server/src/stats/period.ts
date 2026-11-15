import { STATS_PERIOD_DAYS, type StatsPeriod } from '@autoscore/schema';

const DAY_MS = 86_400_000;

// Najstarsze created_at gry w okresie, włącznie. null dla all. now to zegar serwera, nie urządzenia.
export function periodStart(period: StatsPeriod, now: number): string | null {
  const days = STATS_PERIOD_DAYS[period];
  if (days === null) {
    return null;
  }
  return new Date(now - days * DAY_MS).toISOString();
}
