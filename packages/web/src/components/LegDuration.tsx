import { durationSeconds, formatDuration, spokenDuration } from '../game/leg-clock';
import { pl } from '../i18n/pl';
import { ClockIcon } from './icons';

export function LegDuration({ ms }: { ms: number }) {
  const seconds = durationSeconds(ms);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-(--radius-pill) bg-(--color-surface-soft) px-3 py-1 font-display font-bold tabular-nums text-(--color-text)">
      <ClockIcon className="text-(--color-text-sub)" />
      <span aria-hidden="true">{formatDuration(seconds)}</span>
      <span className="sr-only">{pl.legTime(spokenDuration(seconds))}</span>
    </span>
  );
}
