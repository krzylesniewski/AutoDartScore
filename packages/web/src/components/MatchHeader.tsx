import type { MatchSnapshot } from '@autoscore/schema';
import { useEffect, useId, useRef, useState } from 'react';
import { canAbandon } from '../game/can-abandon';
import { canEndPractice } from '../game/can-end-practice';
import { pl } from '../i18n/pl';
import { EffectsToggle } from './EffectsToggle';
import { PauseIcon, StopIcon, TargetIcon } from './icons';
import { LegClock } from './LegClock';
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

const chip = 'rounded-(--radius-chip) border-(length:--border-width) px-3 py-1 text-(length:--text-button) lg:px-2 lg:text-[16px] xl:px-3 xl:text-(length:--text-button)';
// Od lg panel ma display: contents, a order stawia kolejkę i zegar zaraz po chipach, a chip stanu tuż przed akcjami, jak na monitorze. Chip jest tylko w grze
// porzuconej lub zakończonej, gdzie Porzuć mecz i Zakończ trening są ukryte. Na xl ujemny margines zmniejsza odstęp do gap-2 z grupy akcji.
const statusChip = `${chip} flex items-center gap-2 self-center border-(--color-accent) font-display font-semibold whitespace-nowrap max-sm:gap-1 max-sm:px-2 max-sm:text-base lg:order-3 lg:ml-auto lg:gap-1 xl:-mr-2 xl:gap-2`;
const button = 'flex min-h-12 items-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-4 font-display text-(length:--text-button) font-semibold lg:px-2.5 xl:px-4';

// Poniżej lg chipy i akcje są w rozwijanym panelu. Panel zostaje w DOM i chowa go tylko klasa, więc każdy przycisk istnieje raz.
// W porzuconej lub zakończonej grze pasek od lg może przejść do drugiego wiersza, żeby chipy nie ścisnęły się w kolumnę.
export function MatchHeader({ state, voiceEnabled, onVoiceChange, effectsEnabled, onEffectsChange, onAbandon, onResume, onEndPractice }: MatchHeaderProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const statusShown = state?.status === 'ended' || state?.status === 'abandoned';

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function closeAfter(action: (() => void) | undefined): () => void {
    return () => {
      action?.();
      setOpen(false);
    };
  }

  return (
    <header
      className={`flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-(--color-border-subtle) bg-(--color-surface-header) px-3 py-2 sm:gap-x-3 sm:px-(--space-page) lg:gap-2 lg:px-3 xl:gap-4 xl:px-(--space-page) ${statusShown ? '' : 'lg:flex-nowrap'}`}
    >
      <a href="#/" aria-label={pl.home} className="flex items-center gap-2 font-display text-[24px] font-bold whitespace-nowrap text-(--color-text) xl:text-(length:--text-heading) xl:whitespace-normal">
        <TargetIcon className="text-(--color-accent)" />
        {pl.appName}
      </a>
      {state?.status === 'ended' && (
        <span className={statusChip}>
          <StopIcon className="text-(--color-accent)" />
          {pl.statusEnded}
        </span>
      )}
      {state?.status === 'abandoned' && (
        <span className={statusChip}>
          <PauseIcon className="text-(--color-accent)" />
          {pl.statusAbandoned}
        </span>
      )}
      {/* Od lg kolejka stoi nad zegarem, bo w jednym wierszu pasek nie mieści się przy 1024 px. */}
      {state && !state.finished && (
        <div className="flex items-center gap-2 font-display text-(length:--text-button) font-semibold whitespace-nowrap tabular-nums sm:gap-3 lg:order-2 lg:flex-col lg:items-start lg:gap-0 lg:text-[16px] lg:leading-tight xl:text-(length:--text-button)">
          {state.round !== null && <Round round={state.round} />}
          <LegClock state={state} />
        </div>
      )}
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={`${button} ml-auto border-(--color-border-strong) bg-(--color-surface-button) max-sm:px-3 lg:hidden`}
      >
        <MenuIcon />
        <span className="max-sm:sr-only">{pl.gameMenu}</span>
      </button>
      <div id={panelId} className={`${open ? 'flex' : 'hidden'} basis-full flex-col gap-3 pb-1 lg:contents`}>
        {state && (
          <ul className="flex flex-wrap items-center gap-2 lg:order-1 lg:gap-1.5 xl:gap-2">
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
        <div className={`flex flex-wrap gap-2 lg:order-4 lg:flex-nowrap lg:whitespace-nowrap xl:whitespace-normal ${statusShown ? '' : 'lg:ml-auto'}`}>
          {state && canAbandon(state) && (
            <button type="button" onClick={closeAfter(onAbandon)} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
              {pl.abandonMatch}
            </button>
          )}
          {state && canEndPractice(state) && (
            <button type="button" onClick={closeAfter(onEndPractice)} className={`${button} border-(--color-border-strong) bg-(--color-surface-button)`}>
              {pl.endPractice}
            </button>
          )}
          {state?.status === 'abandoned' && (
            <button type="button" onClick={closeAfter(onResume)} className={`${button} border-(--color-text) bg-(--color-text) text-(--color-text-inverse)`}>
              {pl.resumeMatch}
            </button>
          )}
          <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} />
          <EffectsToggle enabled={effectsEnabled} onChange={onEffectsChange} />
        </div>
      </div>
    </header>
  );
}

// Niewidoczna dwucyfrowa kopia trzyma szerokość, więc przejście z 9 na 10 niczego nie przesuwa.
function Round({ round }: { round: number }) {
  return (
    <span className="inline-grid">
      <span className="col-start-1 row-start-1">{pl.round(round)}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {pl.round(88)}
      </span>
    </span>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="inline-block h-[1em] w-[1em] shrink-0">
      <path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z" />
    </svg>
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
