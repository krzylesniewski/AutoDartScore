import type { MatchSnapshot } from '@autoscore/schema';
import { canAbandon } from '../game/can-abandon';
import { canEndPractice } from '../game/can-end-practice';
import { pl } from '../i18n/pl';
import { EffectsToggle } from './EffectsToggle';
import { PauseIcon, StopIcon, TargetIcon } from './icons';
import { VoiceToggle } from './VoiceToggle';

export interface MatchHeaderProps {
  state: MatchSnapshot | null;
  voiceEnabled: boolean;
  onVoiceChange(next: boolean): void;
  effectsEnabled: boolean;
  onEffectsChange(next: boolean): void;
  onAbandon?: () => void;
  onResume?: () => void;
  onEndPractice?: () => void;
}

const chip = 'rounded-(--radius-chip) border-(length:--border-width) px-3 py-1 text-(length:--text-button)';
const button = 'flex min-h-12 items-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-4 font-display text-(length:--text-button) font-semibold';

export function MatchHeader({ state, voiceEnabled, onVoiceChange, effectsEnabled, onEffectsChange, onAbandon, onResume, onEndPractice }: MatchHeaderProps) {
  return (
    <header className="flex items-center gap-4 border-b border-(--color-border-subtle) bg-(--color-surface-header) px-(--space-page) py-2">
      <a href="#/" aria-label={pl.home} className="flex items-center gap-2 font-display text-(length:--text-heading) font-bold text-(--color-text)">
        <TargetIcon className="text-(--color-accent)" />
        {pl.appName}
      </a>
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
      <div className="ml-auto flex gap-2">
        {state && canAbandon(state) && (
          <button type="button" onClick={onAbandon} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
            {pl.abandonMatch}
          </button>
        )}
        {state && canEndPractice(state) && (
          <button type="button" onClick={onEndPractice} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
            {pl.endPractice}
          </button>
        )}
        {state?.status === 'ended' && (
          <span className={`${chip} flex items-center gap-2 self-center border-(--color-accent) font-display font-semibold`}>
            <StopIcon className="text-(--color-accent)" />
            {pl.statusEnded}
          </span>
        )}
        {state?.status === 'abandoned' && (
          <>
            <span className={`${chip} flex items-center gap-2 self-center border-(--color-accent) font-display font-semibold`}>
              <PauseIcon className="text-(--color-accent)" />
              {pl.statusAbandoned}
            </span>
            <button type="button" onClick={onResume} className={`${button} border-(--color-text) bg-(--color-text) text-(--color-text-inverse)`}>
              {pl.resumeMatch}
            </button>
          </>
        )}
        <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} />
        <EffectsToggle enabled={effectsEnabled} onChange={onEffectsChange} />
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
