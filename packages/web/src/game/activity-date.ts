import { pl } from '../i18n/pl';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Czas ostatniej aktywności w strefie urządzenia: dziś z godziną, wczoraj, potem sama data.
export function formatActivity(iso: string, now: Date): string {
  const date = new Date(iso);
  if (sameDay(date, now)) {
    return pl.activityToday(`${pad(date.getHours())}:${pad(date.getMinutes())}`);
  }
  if (sameDay(date, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
    return pl.activityYesterday;
  }
  const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day}.${date.getFullYear()}`;
}
