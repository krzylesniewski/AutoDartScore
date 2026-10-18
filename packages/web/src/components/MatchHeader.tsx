import type { MatchSnapshot } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { TargetIcon } from './icons';
import { VoiceToggle } from './VoiceToggle';

export interface MatchHeaderProps {
  state: MatchSnapshot | null;
  voiceEnabled: boolean;
  onVoiceChange(next: boolean): void;
}

const chip = 'rounded-(--radius-chip) border-(length:--border-width) px-3 py-1 text-(length:--text-button)';

export function MatchHeader({ state, voiceEnabled, onVoiceChange }: MatchHeaderProps) {
  return (
    <header className="flex items-center gap-4 border-b border-(--color-border-subtle) bg-(--color-surface-header) px-(--space-page) py-2">
      <span className="flex items-center gap-2 font-display text-(length:--text-heading) font-bold">
        <TargetIcon className="text-(--color-accent)" />
        {pl.appName}
      </span>
      {state && (
        <ul className="flex flex-wrap items-center gap-2">
          {chips(state).map((label) => (
            <li key={label} className={`${chip} border-(--color-border-strong) text-(--color-text-muted)`}>
              {label}
            </li>
          ))}
          {state.type === 'match' && (
            <li className={`${chip} border-(--color-text) bg-(--color-text) font-semibold text-(--color-text-inverse)`}>{pl.legNumber(state.legIndex + 1)}</li>
          )}
        </ul>
      )}
      <div className="ml-auto">
        <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} />
      </div>
    </header>
  );
}

function chips(state: MatchSnapshot): string[] {
  const labels: string[] = [];
  if (state.type === 'casual') {
    labels.push(pl.typeCasual);
  }
  if (state.type === 'practice') {
    labels.push(state.practiceMode === 'solo_501' ? pl.solo501 : pl.freeRun);
  }
  if (state.type !== 'practice' && state.startingScore !== null) {
    labels.push(String(state.startingScore));
  }
  if (state.startingScore !== null) {
    labels.push(pl.doubleOut);
  }
  if (state.type === 'match' && state.legsToWin !== null) {
    labels.push(pl.bestOfOption(state.legsToWin * 2 - 1));
  }
  return labels;
}
