import type { MatchSnapshot } from '@autoscore/schema';
import { durationSeconds, formatDuration, legElapsedMs, spokenDuration } from '../game/leg-clock';
import { useNow } from '../game/use-now';
import { pl } from '../i18n/pl';
import { ClockIcon } from './icons';

// Najszersza wartość poniżej godziny. Niewidoczna kopia trzyma szerokość, więc zmiana 9:59 na 10:00 niczego nie przesuwa.
const WIDEST = formatDuration(59 * 60 + 59);

// Osobny komponent, żeby co sekundę renderował się tylko zegar, a nie nagłówek ani klawiatura.
export function LegClock({ state, className }: { state: MatchSnapshot; className?: string }) {
  const ticking = state.status === 'in_progress' && state.legStartedAt !== null;
  const seconds = durationSeconds(legElapsedMs(state, useNow(ticking)));
  const spoken = spokenDuration(seconds);
  const freeRun = state.practiceMode === 'free_run';

  return (
    <span role="timer" aria-label={freeRun ? pl.sessionTime(spoken) : pl.legTime(spoken)} className={`flex items-center gap-1 tabular-nums ${className ?? ''}`}>
      <ClockIcon className="text-(--color-text-muted)" />
      <span aria-hidden="true" className="inline-grid">
        <span className="col-start-1 row-start-1">{formatDuration(seconds)}</span>
        <span className="invisible col-start-1 row-start-1">{WIDEST}</span>
      </span>
    </span>
  );
}
