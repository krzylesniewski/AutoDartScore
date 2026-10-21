import { hitPoints } from '@autoscore/engine';
import type { Hit, MatchSnapshot } from '@autoscore/schema';
import type { ReactNode } from 'react';
import type { LastTurn } from '../api/use-match';
import { checkoutRoute } from '../game/checkout-route';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { BustIcon, FlagIcon, UndoIcon } from './icons';
import { SHORTCUT_BADGE } from './KeypadKey';

const DARTS_PER_TURN = 3;

const card = 'rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface)';
// Poniżej lg suma i zamknięcie dzielą jedną kartę, od lg każde ma własną.
const sharedCard =
  'max-lg:rounded-(--radius-card) max-lg:border-(length:--border-width) max-lg:border-(--color-border) max-lg:bg-(--color-surface) max-lg:px-4 max-lg:py-2';
const ownCard = 'lg:rounded-(--radius-card) lg:border-(length:--border-width) lg:border-(--color-border) lg:bg-(--color-surface)';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const button =
  'flex min-h-12 flex-wrap items-center justify-center gap-x-2 rounded-(--radius-card) border-(length:--border-width) px-2 py-1 text-center font-display text-(length:--text-button) leading-tight font-semibold lg:px-3';

export interface TurnPanelProps {
  state: MatchSnapshot;
  lastTurn: LastTurn | null;
  busy: boolean;
  undoDisabled?: boolean;
  onUndo(): void;
  onCheckout(hit: Hit): void;
  checkoutDisabled: boolean;
}

export function TurnPanel({ state, lastTurn, busy, undoDisabled = false, onUndo, onCheckout, checkoutDisabled }: TurnPanelProps) {
  // Pusta tura zaraz po zamknięciu pokazuje ostatnią turę, dopóki nie przyjdzie kolejna zmiana stanu.
  const shown = state.currentDarts.length === 0 && lastTurn?.eventSeq === state.eventSeq ? lastTurn : null;
  const darts: readonly Hit[] = shown ? shown.darts : state.currentDarts;
  const shownName = shown ? state.players.find((player) => player.id === shown.playerId)?.name : undefined;
  const thrower = state.finished ? undefined : state.players.find((player) => player.id === state.currentPlayerId);
  const waitingIndex = thrower && !shown ? darts.length : -1;

  return (
    <section className="@container flex flex-col gap-3">
      {thrower && (
        <div className="flex flex-nowrap items-baseline justify-between gap-x-4">
          <h2 className="min-w-0 truncate font-display text-(length:--text-heading) leading-tight font-bold">{pl.playerThrows(thrower.name)}</h2>
          <span className="shrink-0 whitespace-nowrap text-(--color-text-muted)">{pl.dartOfTurn(state.currentDarts.length + 1)}</span>
        </div>
      )}
      <ol className={`grid grid-cols-3 gap-3 ${shown ? 'opacity-50' : ''}`}>
        {Array.from({ length: DARTS_PER_TURN }, (_, index) => (
          <DartSlot key={index} index={index} dart={darts[index]} waiting={index === waitingIndex} />
        ))}
      </ol>
      {/* Od lg pusta linia trzyma miejsce na imię, żeby klawiatura nie skakała przy pokazaniu zamkniętej tury. */}
      <p aria-hidden={shownName ? undefined : 'true'} className={`font-display text-lg text-(--color-text-muted) ${shownName ? '' : 'max-lg:hidden'}`}>
        {shownName ?? ' '}
      </p>
      <div className={`flex gap-3 ${sharedCard}`}>
        <div
          className={`flex flex-1 flex-col items-start justify-center gap-1 lg:h-20 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:px-5 ${ownCard}`}
        >
          <span className={label}>{pl.turnTotal}</span>
          <TurnTotal darts={darts} shown={shown} />
        </div>
        <CheckoutHint state={state} onCheckout={onCheckout} disabled={checkoutDisabled} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onUndo}
          disabled={busy || undoDisabled}
          aria-keyshortcuts="Backspace"
          className={`relative ${button} border-(--color-border-strong) bg-(--color-surface-button) disabled:opacity-40`}
        >
          <UndoIcon />
          {pl.undo}
          <span aria-hidden="true" className={SHORTCUT_BADGE}>
            {pl.shortcutBackspace}
          </span>
        </button>
        <SoonButton label={pl.nextRound} className="border-(--color-border-strong) bg-(--color-surface-button)" />
        <SoonButton label={pl.toReview} icon={<FlagIcon />} className="border-(--color-accent) bg-(--color-bg)" />
      </div>
    </section>
  );
}

function DartSlot({ index, dart, waiting }: { index: number; dart: Hit | undefined; waiting: boolean }) {
  return (
    <li
      aria-label={pl.dartSlot(index + 1)}
      className={`flex h-[78px] flex-col items-center justify-center lg:h-28 lg:gap-1 ${
        waiting
          ? 'rounded-(--radius-card) border-(length:--border-width) border-dashed border-(--color-accent) bg-(--color-bg)'
          : card
      }`}
    >
      <span className={`${label} leading-tight`}>{pl.dartSlot(index + 1)}</span>
      <span
        className={`font-display text-[clamp(30px,8cqi,36px)] leading-none font-bold lg:text-[clamp(40px,7cqi,48px)] ${dart ? '' : 'text-(--color-text-muted)'}`}
      >
        {dart ? hitLabel(dart) : waiting ? '?' : ' '}
      </span>
      <span className="text-sm leading-tight text-(--color-text-muted) lg:text-lg lg:leading-tight">
        {dart ? hitPoints(dart) : waiting ? pl.waitingForDart : ' '}
      </span>
    </li>
  );
}

function TurnTotal({ darts, shown }: { darts: readonly Hit[]; shown: LastTurn | null }) {
  if (shown?.bust) {
    return (
      <span className="flex items-center gap-2 font-display text-[clamp(32px,10cqi,44px)] leading-none font-bold">
        <BustIcon className="text-(--color-accent)" />
        {pl.bust}
      </span>
    );
  }
  const total = shown?.total ?? darts.reduce((sum, dart) => sum + hitPoints(dart), 0);
  return (
    <span className="flex items-baseline gap-2 font-display lg:gap-4">
      {darts.length >= 2 && <span className="text-lg text-(--color-text-muted)">{darts.map(hitPoints).join(' + ')}</span>}
      <span className="text-[clamp(32px,10cqi,44px)] leading-none font-bold tabular-nums">{total}</span>
    </span>
  );
}

interface CheckoutHintProps {
  state: MatchSnapshot;
  onCheckout(hit: Hit): void;
  disabled: boolean;
}

const checkoutCard = `flex flex-1 flex-col items-end justify-center gap-1 lg:grid lg:h-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:content-center lg:items-center lg:gap-x-4 lg:gap-y-0 lg:px-5 ${ownCard}`;
const checkoutChip =
  'rounded-(--radius-chip) bg-(--color-accent) px-3 py-1 font-display text-[clamp(28px,8cqi,44px)] leading-none font-bold whitespace-nowrap text-(--color-on-accent) lg:col-start-2 lg:row-start-1 lg:px-5';

function CheckoutHint({ state, onCheckout, disabled }: CheckoutHintProps) {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  if (state.finished || state.startingScore === null || !player || player.remaining === null) {
    return null;
  }
  const route = checkoutRoute(state);
  const first = route?.[0];
  // Bez trasy zostaje niewidoczna karta tej samej wysokości, żeby od lg klawiatura nie skakała przy pojawieniu się podpowiedzi.
  if (!route || !first) {
    return (
      <div aria-hidden="true" className={`${checkoutCard} invisible max-lg:hidden`}>
        <span className={`${label} lg:col-start-1 lg:row-start-1`}>{' '}</span>
        <span className={`${checkoutChip} lg:row-span-2`}>{' '}</span>
        <span className="text-right text-sm text-(--color-text-muted) lg:col-start-1 lg:row-start-2 lg:text-left lg:text-base">{' '}</span>
      </div>
    );
  }
  const firstLabel = hitLabel(first);
  // Od lg siatka: etykieta, opis i instrukcja po lewej, chip po prawej przez wszystkie wiersze.
  return (
    <button
      type="button"
      disabled={disabled}
      aria-keyshortcuts="Enter"
      onClick={() => onCheckout(first)}
      className={`${checkoutCard} cursor-pointer text-start disabled:cursor-default`}
    >
      <span className={`${label} lg:col-start-1 lg:row-start-1`}>{pl.checkout}</span>
      <span className={`${checkoutChip} lg:row-span-3`}>{route.map(hitLabel).join(' ')}</span>
      <span className="text-right text-sm text-(--color-text-muted) lg:col-start-1 lg:row-start-2 lg:text-left lg:text-base">
        {`${pl.darts(route.length)} ${pl.toWinLeg}`}
      </span>
      <span className="max-w-full truncate text-right text-sm leading-tight text-(--color-text-muted) lg:col-start-1 lg:row-start-3 lg:text-left">
        <span className="pointer-coarse:hidden">{pl.checkoutClickHint(firstLabel)}</span>
        <span className="hidden pointer-coarse:inline">{pl.checkoutTapHint(firstLabel)}</span>
      </span>
    </button>
  );
}

function SoonButton({ label: text, icon, className }: { label: string; icon?: ReactNode; className: string }) {
  return (
    <button type="button" disabled className={`${button} ${className}`}>
      {icon}
      {text}
      <span className="text-xs font-normal text-(--color-text-muted)">{pl.soon}</span>
    </button>
  );
}
