import type { MatchSnapshot } from '@autoscore/schema';
import { durationSeconds, formatDuration, gameElapsedMs } from '../game/leg-clock';
import { pl } from '../i18n/pl';

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

// Bez początku albo końca gry nie ma czego pokazać, więc nie zostaje pusta etykieta.
export function GameTime({ state, className }: { state: MatchSnapshot; className?: string }) {
  const elapsed = gameElapsedMs(state);
  if (elapsed === null) {
    return null;
  }
  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      <span className={label}>{pl.gameTimeLabel}</span>
      <span className="font-display text-[length:clamp(2rem,5vw,3rem)] leading-tight font-bold text-(--color-text) tabular-nums">
        {formatDuration(durationSeconds(elapsed))}
      </span>
    </div>
  );
}
