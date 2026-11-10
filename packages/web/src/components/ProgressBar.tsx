import { progressWidth } from '../game/progress-width';
import { pl } from '../i18n/pl';

export interface ProgressBarProps {
  startingScore: number;
  remaining: number;
  current: boolean;
}

// Droga od wyniku startowego do zera. Po buście snapshot przywraca wynik, więc pasek wraca razem z nim.
export function ProgressBar({ startingScore, remaining, current }: ProgressBarProps) {
  return (
    <div role="img" aria-label={pl.progressRemaining(remaining, startingScore)} className={current ? 'sc-progress sc-progress--current' : 'sc-progress'}>
      <span style={{ width: `${progressWidth(startingScore, remaining)}%` }} />
    </div>
  );
}
