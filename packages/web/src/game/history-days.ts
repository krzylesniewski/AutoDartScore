import { activityDay } from './activity-date';

export interface HistoryDay<T> {
  key: string;
  label: string;
  games: T[];
}

function localDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Grupuje tylko sąsiednie gry i nie sortuje, bo kolejność jest z serwera.
// Ten sam dzień może wrócić niżej: porzucenie zmienia updatedAt wiersza bez ponownego pobrania listy. Dlatego klucz ma też numer grupy.
export function groupHistoryByDay<T extends { updatedAt: string }>(games: readonly T[], now: Date): HistoryDay<T>[] {
  const days: { date: string; day: HistoryDay<T> }[] = [];
  for (const game of games) {
    const date = localDate(game.updatedAt);
    const last = days.at(-1);
    if (last && last.date === date) {
      last.day.games.push(game);
    } else {
      days.push({ date, day: { key: `${date}-${days.length}`, label: activityDay(game.updatedAt, now), games: [game] } });
    }
  }
  return days.map(({ day }) => day);
}
