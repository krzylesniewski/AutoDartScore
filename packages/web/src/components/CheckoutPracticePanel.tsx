import type { CheckoutAttempt, CheckoutSession } from '@autoscore/schema';
import { useId } from 'react';
import { suggestCheckout } from '../game/checkout';
import { formatCheckoutPercent } from '../game/checkout-practice';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { BustIcon, CheckIcon, UndoIcon } from './icons';
import { SHORTCUT_BADGE } from './KeypadKey';
import { ROUTE_CHIP } from './TurnPanel';

const RECENT_COUNT = 5;

const card = 'rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface)';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const resultButton =
  'relative flex min-h-(--button-height) items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-3 py-2 text-center font-display text-[22px] leading-tight font-bold disabled:opacity-40 lg:min-h-24 lg:text-(length:--text-heading)';

export function CheckoutTargetCard({ session }: { session: CheckoutSession }) {
  const id = useId();
  const route = suggestCheckout(session.target, 3);
  return (
    <section aria-labelledby={id} className={`@container flex flex-col items-center gap-2 px-4 py-3 sm:gap-3 lg:gap-5 lg:py-10 ${card}`}>
      <h2 id={id} className={label}>
        {pl.checkoutTarget}
      </h2>
      <p className="font-display text-[clamp(64px,24cqi,200px)] leading-none font-bold tabular-nums">{session.target}</p>
      {route && <p className={ROUTE_CHIP}>{route.map(hitLabel).join(' ')}</p>}
      <p className="font-display text-xl text-(--color-text-muted) tabular-nums lg:text-2xl">
        {pl.checkoutCounter(session.successes, session.attempts, formatCheckoutPercent(session))}
      </p>
    </section>
  );
}

export interface CheckoutActionsProps {
  resultsDisabled: boolean;
  undoDisabled: boolean;
  busy: boolean;
  onResult(success: boolean): void;
  onUndo(): void;
}

// Do odpowiedzi serwera widoczny cel jest nieaktualny, więc kliknięcia w trakcie komendy przepadają zamiast czekać w kolejce.
export function CheckoutActions({ resultsDisabled, undoDisabled, busy, onResult, onUndo }: CheckoutActionsProps) {
  function result(success: boolean): void {
    if (!busy) {
      onResult(success);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={resultsDisabled}
          onClick={() => result(false)}
          title={pl.checkoutFailureShortcut}
          aria-keyshortcuts="0"
          className={`${resultButton} border-(--color-accent) bg-(--color-surface-button) text-(--color-text)`}
        >
          <BustIcon className="text-(--color-accent)" />
          {pl.checkoutFailure}
          <span aria-hidden="true" className={SHORTCUT_BADGE}>
            0
          </span>
        </button>
        <button
          type="button"
          disabled={resultsDisabled}
          onClick={() => result(true)}
          title={pl.checkoutSuccessShortcut}
          aria-keyshortcuts="Enter 1"
          className={`${resultButton} border-(--color-text) bg-(--color-text) text-(--color-text-inverse)`}
        >
          <CheckIcon />
          {pl.checkoutSuccess}
          <span aria-hidden="true" className={SHORTCUT_BADGE}>
            {pl.shortcutEnterOr1}
          </span>
        </button>
      </div>
      <button
        type="button"
        disabled={undoDisabled}
        onClick={() => {
          if (!busy) {
            onUndo();
          }
        }}
        title={pl.undoShortcut}
        aria-keyshortcuts="Backspace"
        className="relative flex min-h-12 items-center justify-center gap-2 self-start rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-5 font-display text-(length:--text-button) font-semibold disabled:opacity-40 lg:min-w-56"
      >
        <UndoIcon />
        {pl.undo}
        <span aria-hidden="true" className={SHORTCUT_BADGE}>
          {pl.shortcutBackspace}
        </span>
      </button>
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
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className={label}>
        {pl.checkoutRecent}
      </h2>
      {recent.length === 0 ? (
        <p className="h-39 text-(--color-text-muted) lg:h-58">{pl.checkoutNoAttempts}</p>
      ) : (
        <ol className="flex h-39 flex-col gap-1 lg:h-58 lg:gap-2">
          {recent.map(({ attempt, number }) => (
            <AttemptRow key={number} attempt={attempt} number={number} className="h-7 lg:h-10" />
          ))}
        </ol>
      )}
    </section>
  );
}

export function AttemptRow({ attempt, number, className }: { attempt: CheckoutAttempt; number: number; className: string }) {
  return (
    <li className={`grid grid-cols-[3ch_4ch_1fr] items-center gap-3 border-b border-(--color-border) font-display text-lg lg:text-xl ${className}`}>
      <span className="text-right text-(--color-text-muted) tabular-nums">{pl.checkoutAttemptNumber(number)}</span>
      <span className="text-right font-bold tabular-nums">{attempt.target}</span>
      <AttemptResult success={attempt.success} />
    </li>
  );
}

function AttemptResult({ success }: { success: boolean }) {
  return success ? (
    <span className="flex items-center gap-2">
      <CheckIcon className="text-(--color-status-ok)" />
      {pl.checkoutSuccess}
    </span>
  ) : (
    <span className="flex items-center gap-2 text-(--color-text-muted)">
      <BustIcon className="text-(--color-accent)" />
      {pl.checkoutFailure}
    </span>
  );
}
