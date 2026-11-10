import type { CheckoutAttempt, CheckoutSession } from '@autoscore/schema';
import { useId, useRef } from 'react';
import { suggestCheckout } from '../game/checkout';
import { formatCheckoutPercent } from '../game/checkout-practice';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { CardRings } from './CardRings';
import { CornerRings } from './CornerRings';
import { BustIcon, CheckIcon, ShuffleIcon, UndoIcon } from './icons';
import { KeypadKey, type KeypadKeyHandle, type KeypadKeyTone } from './KeypadKey';
import { ROUTE_CHIP } from './CheckoutCard';
import { useCheckoutShortcuts } from './use-checkout-shortcuts';

const RECENT_COUNT = 5;

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const raisedFill = 'bg-linear-to-b from-(--color-surface-raised) to-(--color-surface)';
// Jak na karcie zamknięcia ekranu gry: biały tekst na jasnym końcu gradientu wymaga pogrubienia i co najmniej 19 px.
const ROUTE_LABEL = 'relative font-display text-[19px] leading-none font-bold tracking-[0.16em] whitespace-nowrap uppercase';
const resultButton =
  'flex min-h-(--button-height) items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-3 py-2 text-center font-display text-[22px] leading-tight font-extrabold disabled:opacity-40 lg:min-h-28 lg:gap-3.5 lg:text-4xl';
// Gradient i cień siedzą w tonie, bo wciśnięty klawisz podmienia całe wypełnienie.
const failureTone: KeypadKeyTone = { fill: `${raisedFill} text-(--color-text) shadow-(--shadow-key)`, border: 'border-(--color-accent)' };
const failurePressedTone: KeypadKeyTone = { fill: 'bg-(--color-surface-raised) text-(--color-text) shadow-(--shadow-key)', border: 'border-(--color-accent)' };
// Wciśnięty zostaje kremowy, jak wybrany mnożnik na klawiaturze rzutek.
const successTone: KeypadKeyTone = { fill: 'bg-(--color-text) text-(--color-text-inverse) shadow-(--shadow-selected)', border: 'border-(--color-text)' };
// Jak klawisz „Reszta tury”: przezroczysta ramka zostaje w spoczynku, żeby błysk akcentu nie przesuwał treści.
const secondaryButton =
  'flex min-h-12 items-center justify-center gap-2.5 rounded-(--radius-button) border-(length:--border-width) px-3 font-display text-[22px] leading-none font-semibold shadow-(--shadow-outline) disabled:opacity-40 lg:min-h-16';
const secondaryTone: KeypadKeyTone = { fill: 'bg-transparent text-(--color-text)', border: 'border-transparent' };

export function CheckoutTargetCard({ session }: { session: CheckoutSession }) {
  const id = useId();
  const route = suggestCheckout(session.target, 3);
  // Od lg karta wypełnia wolną wysokość kolumny, więc przyciski treningu pod nią nie zmieniają miejsca przy kolejnych celach.
  return (
    <section
      aria-labelledby={id}
      className={`@container relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-(--radius-panel) px-4 py-4 shadow-(--shadow-panel) sm:gap-4 lg:min-h-0 lg:flex-1 lg:gap-5 lg:p-7 ${raisedFill}`}
    >
      <CornerRings className="-top-20 -right-20 size-60 lg:-top-30 lg:-right-30 lg:size-105" />
      <h2 id={id} className={`relative ${label}`}>
        {pl.checkoutTarget}
      </h2>
      <p className="relative font-display text-[clamp(64px,24cqi,200px)] leading-[0.8] font-extrabold tabular-nums">{session.target}</p>
      {route && (
        <div className="sc-checkout flex max-w-full flex-col items-center gap-2.5 px-4 pt-3 pb-4 lg:px-5.5 lg:pt-4 lg:pb-5">
          <CardRings className="-top-12 -right-12 size-40 text-(--color-on-accent) opacity-(--opacity-checkout-rings)" />
          <span className={ROUTE_LABEL}>{pl.checkoutInDarts(route.length)}</span>
          <span className="relative flex flex-nowrap gap-3">
            {route.map((hit, index) => (
              <span key={index} className={ROUTE_CHIP}>
                {hitLabel(hit)}
              </span>
            ))}
          </span>
        </div>
      )}
      <p className="relative font-display text-xl font-bold text-(--color-text-sub) tabular-nums lg:text-[26px]">
        {pl.checkoutCounter(session.successes, session.attempts, formatCheckoutPercent(session))}
      </p>
    </section>
  );
}

export interface CheckoutActionsProps {
  resultsDisabled: boolean;
  skipDisabled: boolean;
  undoDisabled: boolean;
  busy: boolean;
  onResult(success: boolean): void;
  onSkip(): void;
  onUndo(): void;
}

// Do odpowiedzi serwera widoczny cel jest nieaktualny, więc kliknięcia w trakcie komendy przepadają zamiast czekać w kolejce.
export function CheckoutActions({ resultsDisabled, skipDisabled, undoDisabled, busy, onResult, onSkip, onUndo }: CheckoutActionsProps) {
  const failureKey = useRef<KeypadKeyHandle>(null);
  const successKey = useRef<KeypadKeyHandle>(null);
  const skipKey = useRef<KeypadKeyHandle>(null);
  const undoKey = useRef<KeypadKeyHandle>(null);

  // Jak skróty klawiatury rzutek: bez połączenia i po końcu sesji klawisze zostają dla przeglądarki.
  useCheckoutShortcuts({
    enabled: !resultsDisabled,
    skipEnabled: !skipDisabled,
    undoEnabled: !undoDisabled,
    onSuccess: () => successKey.current?.press(),
    onFailure: () => failureKey.current?.press(),
    onSkip: () => skipKey.current?.press(),
    onUndo: () => undoKey.current?.press(),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <KeypadKey
          ref={failureKey}
          disabled={resultsDisabled}
          ignorePress={busy}
          flashOnPress
          onPress={() => onResult(false)}
          title={pl.checkoutFailureShortcut}
          shortcut={{ keys: '0', label: '0' }}
          className={resultButton}
          idleTone={failureTone}
          pressedTone={failurePressedTone}
          flashBorder="border-(--color-text)"
        >
          <BustIcon className="text-(--color-accent)" />
          {pl.checkoutFailure}
        </KeypadKey>
        <KeypadKey
          ref={successKey}
          disabled={resultsDisabled}
          ignorePress={busy}
          flashOnPress
          onPress={() => onResult(true)}
          title={pl.checkoutSuccessShortcut}
          shortcut={{ keys: 'Enter 1', label: pl.shortcutEnterOr1 }}
          className={resultButton}
          idleTone={successTone}
          pressedTone={successTone}
        >
          <CheckIcon />
          {pl.checkoutSuccess}
        </KeypadKey>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <KeypadKey
          ref={skipKey}
          disabled={skipDisabled}
          ignorePress={busy}
          flashOnPress
          onPress={onSkip}
          title={pl.checkoutSkipShortcut}
          shortcut={{ keys: 'N', label: 'N' }}
          className={secondaryButton}
          idleTone={secondaryTone}
        >
          <ShuffleIcon />
          {pl.checkoutSkip}
        </KeypadKey>
        <KeypadKey
          ref={undoKey}
          disabled={undoDisabled}
          ignorePress={busy}
          flashOnPress
          onPress={onUndo}
          title={pl.undoShortcut}
          shortcut={{ keys: 'Backspace', label: pl.shortcutBackspace }}
          className={secondaryButton}
          idleTone={secondaryTone}
        >
          <UndoIcon />
          {pl.undo}
        </KeypadKey>
      </div>
    </div>
  );
}

// Najnowsza próba na górze. Lista trzyma wysokość pięciu wierszy, więc karta celu pod nią nie przesuwa się przy kolejnych próbach.
export function CheckoutRecentAttempts({ session }: { session: CheckoutSession }) {
  const id = useId();
  const recent = session.history
    .map((attempt, index) => ({ attempt, number: index + 1 }))
    .slice(-RECENT_COUNT)
    .reverse();
  return (
    <section aria-labelledby={id} className="sc-panel sc-panel--flat gap-2.5">
      <div className="flex items-baseline justify-between gap-3.5">
        <h2 id={id} className="font-display text-[21px] leading-[1.1] font-extrabold">
          {pl.checkoutRecent}
        </h2>
        <span className="text-[13px] text-(--color-text-muted)">{pl.checkoutRecentHint}</span>
      </div>
      {recent.length === 0 ? (
        <p className="h-40 text-(--color-text-muted) lg:h-70">{pl.checkoutNoAttempts}</p>
      ) : (
        <ol className="flex h-40 flex-col lg:h-70">
          {recent.map(({ attempt, number }) => (
            <AttemptRow key={number} attempt={attempt} number={number} className="h-8 lg:h-14" />
          ))}
        </ol>
      )}
    </section>
  );
}

export function AttemptRow({ attempt, number, className }: { attempt: CheckoutAttempt; number: number; className: string }) {
  return (
    <li className={`grid grid-cols-[3ch_4ch_1fr] items-center gap-3 border-t border-(--color-border) font-display tabular-nums ${className}`}>
      <span className="text-right text-lg font-semibold text-(--color-text-muted) lg:text-[19px]">{pl.checkoutAttemptNumber(number)}</span>
      <span className="text-right text-xl font-extrabold lg:text-[28px]">{attempt.target}</span>
      <AttemptResult success={attempt.success} />
    </li>
  );
}

function AttemptResult({ success }: { success: boolean }) {
  return success ? (
    <span className="flex items-center gap-2 text-lg font-bold lg:text-xl">
      <CheckIcon className="text-(--color-status-ok)" />
      {pl.checkoutSuccess}
    </span>
  ) : (
    <span className="flex items-center gap-2 text-lg font-semibold text-(--color-text-muted) lg:text-xl">
      <BustIcon className="text-(--color-accent)" />
      {pl.checkoutFailure}
    </span>
  );
}
