import type { MatchSnapshot } from '@autoscore/schema';
import { useEffect, useId, useRef, useState } from 'react';
import { canAbandon } from '../game/can-abandon';
import { canEndPractice } from '../game/can-end-practice';
import { pl } from '../i18n/pl';
import { AppMark } from './AppMark';
import { EffectsToggle } from './EffectsToggle';
import { MoreIcon, PauseIcon, StopIcon } from './icons';
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

const meta = 'font-display font-semibold whitespace-nowrap text-(--color-text-sub)';
const statusPill = 'sc-status shrink-0 font-display font-semibold whitespace-nowrap max-lg:gap-1.5 max-lg:px-2.5 max-lg:py-1.5 max-lg:text-[13px]';
const menuButton = 'sc-btn h-12 w-full shrink-0 justify-start whitespace-nowrap';
const card = 'rounded-(--radius-card) bg-(--color-surface-raised) p-3 shadow-(--shadow-panel)';
const popover =
  'flex flex-col gap-2 lg:absolute lg:top-full lg:right-(--space-page) lg:min-w-60 lg:rounded-(--radius-card) lg:bg-(--color-surface-raised) lg:p-3 lg:shadow-(--shadow-panel)';

// Jeden DOM na wszystkie szerokości: układ zmieniają tylko klasy, więc każdy tekst i przycisk istnieje raz.
// Od lg panel i blok tytułu mają display: contents, a ich dzieci stają w jednym wierszu paska.
// Poniżej lg panel jest rozwijaną kartą pod paskiem, a blok tytułu dwoma wierszami obok znaku.
// Porzuć mecz i Zakończ trening są od lg w osobnej karcie pod przyciskiem menu.
export function MatchHeader({ state, voiceEnabled, onVoiceChange, effectsEnabled, onEffectsChange, onAbandon, onResume, onEndPractice }: MatchHeaderProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const abandonable = state !== null && canAbandon(state);
  const endable = state !== null && canEndPractice(state);
  // Trening końcówek nie ma kolejek, a zegar stałby na 0:00, bo serwer nie podaje legStartedAt.
  const legShown = state !== null && !state.finished && state.practiceMode !== 'checkouts';

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

  // Otwarte menu musi przykryć dok klawiatury (sticky z-10) i baner od lg (z-20), które stoją dalej w DOM.
  // Zamknięty pasek wraca do z-10, więc okna dialogowe (fixed z-10, dalej w DOM) przykrywają pasek.
  // Akcja menu zamyka menu w tym samym kliknięciu, w którym otwiera okno dialogowe.
  return (
    <header className={`sc-appbar relative ${open ? 'z-30' : 'z-10'} shrink-0 max-lg:h-12 max-lg:gap-2.5 max-lg:px-4 lg:h-17`}>
      <a href="#/" aria-label={pl.home} className="flex shrink-0 items-center gap-(--space-5) text-(--color-text)">
        <AppMark className="size-[26px] lg:size-8" />
        <span className="font-display text-[24px] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase max-lg:sr-only">{pl.appName}</span>
      </a>
      <span aria-hidden="true" className="mx-2 h-6 w-px shrink-0 bg-(--color-border) max-lg:hidden" />
      <div className="flex min-w-0 grow flex-col gap-1 lg:contents">
        {state && (
          <ul className="min-w-0 truncate font-display text-[17px] leading-tight font-bold text-(--color-text) lg:text-[19px] lg:leading-normal lg:font-semibold lg:text-(--color-text-sub) [&>li]:inline [&>li+li]:before:px-1.5 [&>li+li]:before:content-['·']">
            {chips(state).map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
        <span aria-hidden="true" className="hidden lg:block lg:grow" />
        {state && legShown && (
          <div className={`${meta} flex shrink-0 items-center gap-1.5 text-[14px] leading-tight tabular-nums lg:text-[19px] lg:leading-normal`}>
            {state.type === 'match' && (
              <>
                <span>{pl.legNumber(state.legIndex + 1)}</span>
                {state.round !== null && <span aria-hidden="true">·</span>}
              </>
            )}
            {state.round !== null && <Round round={state.round} />}
          </div>
        )}
      </div>
      {state && legShown && (
        <LegClock state={state} className="sc-clock h-8 shrink-0 font-display text-[17px] font-bold max-lg:px-2.5 max-lg:py-0 lg:h-auto lg:text-[19px]" />
      )}
      {state?.status === 'ended' && (
        <span className={statusPill}>
          <StopIcon className="text-(--color-accent)" />
          {pl.statusEnded}
        </span>
      )}
      {state?.status === 'abandoned' && (
        <span className={statusPill}>
          <PauseIcon className="text-(--color-accent)" />
          {pl.statusAbandoned}
        </span>
      )}
      <span aria-hidden="true" className="hidden lg:block lg:grow" />
      <div
        id={panelId}
        className={`${open ? 'flex' : 'hidden'} ${card} absolute top-full right-4 left-4 flex-col gap-2 sm:left-auto sm:w-80 lg:contents`}
      >
        <VoiceToggle enabled={voiceEnabled} onChange={onVoiceChange} variant="icon" />
        <EffectsToggle enabled={effectsEnabled} onChange={onEffectsChange} variant="icon" />
        {state?.status === 'abandoned' && (
          <button
            type="button"
            onClick={closeAfter(onResume)}
            className="sc-btn h-12 shrink-0 bg-(--color-text) font-bold whitespace-nowrap text-(--color-text-inverse) max-lg:w-full max-lg:justify-start lg:h-11"
          >
            {pl.resumeMatch}
          </button>
        )}
        {(abandonable || endable) && (
          <div className={`${popover} ${open ? 'lg:flex' : 'lg:hidden'}`}>
            {abandonable && (
              <button type="button" onClick={closeAfter(onAbandon)} className={menuButton}>
                {pl.abandonMatch}
              </button>
            )}
            {endable && (
              <button type="button" onClick={closeAfter(onEndPractice)} className={menuButton}>
                {pl.endPractice}
              </button>
            )}
          </div>
        )}
      </div>
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
        className={`sc-btn sc-btn--icon shrink-0 ${abandonable || endable ? '' : 'lg:hidden'}`}
      >
        <MoreIcon className="text-[20px]" />
        <span className="sr-only">{pl.gameMenu}</span>
      </button>
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

// Kropki między pozycjami rysuje ::before, więc tekst pozycji listy zostaje bez separatora.
function chips(state: MatchSnapshot): string[] {
  const labels: string[] = [];
  if (state.type === 'match') {
    labels.push(pl.typeMatch);
  }
  if (state.type === 'casual') {
    labels.push(pl.typeCasual);
  }
  if (state.type === 'practice') {
    labels.push(...practiceChips(state));
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

function practiceChips(state: MatchSnapshot): string[] {
  switch (state.practiceMode) {
    case 'solo_501':
      return [pl.solo501];
    case 'checkouts':
      return state.checkouts ? [pl.checkoutPractice, state.checkouts.range] : [pl.checkoutPractice];
    default:
      return [pl.freeRun];
  }
}
