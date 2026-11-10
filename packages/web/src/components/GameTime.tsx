import type { MatchSnapshot } from '@autoscore/schema';
import { durationSeconds, formatDuration, gameElapsedMs } from '../game/leg-clock';
import { pl } from '../i18n/pl';
import { ClockIcon } from './icons';

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

// Bez początku albo końca gry nie ma czego pokazać, więc nie zostaje pusta etykieta.
export function GameTime({ state, className }: { state: MatchSnapshot; className?: string }) {
  const elapsed = gameElapsedMs(state);
  if (elapsed === null) {
    return null;
  }
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-(--radius-pill) bg-(--color-surface-soft) shadow-(--shadow-inset-line) py-1.5 pl-3.5 pr-4.5 ${className ?? ''}`}
    >
      <ClockIcon className="text-xl text-(--color-text-sub)" />
      <span className={label}>{pl.gameTimeLabel}</span>
      <span className="font-display text-[length:clamp(1.625rem,4vw,2.125rem)] leading-tight font-extrabold text-(--color-text) tabular-nums">
        {formatDuration(durationSeconds(elapsed))}
      </span>
    </div>
  );
}
