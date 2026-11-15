import { StatsPeriod } from '@autoscore/schema';

export const STATS_PERIOD_STORAGE_KEY = 'autoscore.statsPeriod';

// Brak wpisu, nieznana wartość albo niedostępny localStorage oznacza cały czas.
export function readStatsPeriod(): StatsPeriod {
  try {
    const parsed = StatsPeriod.safeParse(localStorage.getItem(STATS_PERIOD_STORAGE_KEY));
    return parsed.success ? parsed.data : 'all';
  } catch {
    return 'all';
  }
}

export function writeStatsPeriod(period: StatsPeriod): void {
  try {
    localStorage.setItem(STATS_PERIOD_STORAGE_KEY, period);
  } catch {
    // Wybór zostaje tylko do przeładowania strony.
  }
}
