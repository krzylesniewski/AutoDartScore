import { durationSeconds, formatDuration, spokenDuration } from '../game/leg-clock';
import { pl } from '../i18n/pl';
import { ClockIcon } from './icons';

export function LegDuration({ ms }: { ms: number }) {
  const seconds = durationSeconds(ms);
  return (
    <span className="flex items-center gap-1 text-(--color-text-muted) tabular-nums">
      <ClockIcon />
      <span aria-hidden="true">{formatDuration(seconds)}</span>
      <span className="sr-only">{pl.legTime(spokenDuration(seconds))}</span>
    </span>
  );
}
