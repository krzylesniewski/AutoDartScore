import { hitPoints } from '@autoscore/engine';
import type { Hit, MatchSnapshot } from '@autoscore/schema';
import type { ReactNode } from 'react';
import type { LastTurn } from '../api/use-match';
import { suggestCheckout } from '../game/checkout';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { BustIcon, FlagIcon, UndoIcon } from './icons';

const DARTS_PER_TURN = 3;

const card = 'rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface)';
const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const button =
  'flex h-(--button-height) items-center justify-center gap-2 rounded-(--radius-card) border-(length:--border-width) px-5 font-display text-(length:--text-button) font-semibold';

export interface TurnPanelProps {
  state: MatchSnapshot;
  lastTurn: LastTurn | null;
  busy: boolean;
  undoDisabled?: boolean;
  onUndo(): void;
}

export function TurnPanel({ state, lastTurn, busy, undoDisabled = false, onUndo }: TurnPanelProps) {
  // Pusta tura zaraz po zamknięciu pokazuje ostatnią turę, dopóki nie przyjdzie kolejna zmiana stanu.
  const shown = state.currentDarts.length === 0 && lastTurn?.eventSeq === state.eventSeq ? lastTurn : null;
  const darts: readonly Hit[] = shown ? shown.darts : state.currentDarts;
  const shownName = shown ? state.players.find((player) => player.id === shown.playerId)?.name : undefined;
  const thrower = state.finished ? undefined : state.players.find((player) => player.id === state.currentPlayerId);
  const waitingIndex = thrower && !shown ? darts.length : -1;

  return (
    <section className="flex flex-col gap-3">
      {thrower && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-(length:--text-heading) leading-tight font-bold">{pl.playerThrows(thrower.name)}</h2>
          <span className="text-(--color-text-muted)">{pl.dartOfTurn(state.currentDarts.length + 1)}</span>
        </div>
      )}
      <ol className={`grid grid-cols-3 gap-3 ${shown ? 'opacity-50' : ''}`}>
        {Array.from({ length: DARTS_PER_TURN }, (_, index) => (
          <DartSlot key={index} index={index} dart={darts[index]} waiting={index === waitingIndex} />
        ))}
      </ol>
      {shownName && <p className="font-display text-lg text-(--color-text-muted)">{shownName}</p>}
      <div className="flex gap-3">
        <div className={`flex flex-1 items-center justify-between gap-4 px-5 py-3 ${card}`}>
          <span className={label}>{pl.turnTotal}</span>
          <TurnTotal darts={darts} shown={shown} />
        </div>
        <CheckoutHint state={state} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onUndo}
          disabled={busy || undoDisabled}
          className={`${button} border-(--color-border-strong) bg-(--color-surface-button) disabled:opacity-40`}
        >
          <UndoIcon />
          {pl.undo}
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
      className={`flex flex-col items-center gap-1 py-3 ${
        waiting
          ? 'rounded-(--radius-card) border-(length:--border-width) border-dashed border-(--color-accent) bg-(--color-bg)'
          : card
      }`}
    >
      <span className={label}>{pl.dartSlot(index + 1)}</span>
      <span className={`font-display text-(length:--text-dart-fit) leading-none font-bold ${dart ? '' : 'text-(--color-text-muted)'}`}>
        {dart ? hitLabel(dart) : waiting ? '?' : ' '}
      </span>
      <span className="text-lg text-(--color-text-muted)">{dart ? hitPoints(dart) : waiting ? pl.waitingForDart : ' '}</span>
    </li>
  );
}

function TurnTotal({ darts, shown }: { darts: readonly Hit[]; shown: LastTurn | null }) {
  if (shown?.bust) {
    return (
      <span className="flex items-center gap-2 font-display text-(length:--text-turn-total-fit) leading-none font-bold">
        <BustIcon className="text-(--color-accent)" />
        {pl.bust}
      </span>
    );
  }
  const total = shown?.total ?? darts.reduce((sum, dart) => sum + hitPoints(dart), 0);
  return (
    <span className="flex items-baseline gap-4 font-display">
      {darts.length >= 2 && <span className="text-3xl text-(--color-text-muted)">{darts.map(hitPoints).join(' + ')}</span>}
      <span className="text-(length:--text-turn-total-fit) leading-none font-bold tabular-nums">{total}</span>
    </span>
  );
}

function CheckoutHint({ state }: { state: MatchSnapshot }) {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  if (state.finished || state.startingScore === null || !player || player.remaining === null) {
    return null;
  }
  const dartsLeft = (DARTS_PER_TURN - state.currentDarts.length) as 1 | 2 | 3;
  const route = suggestCheckout(player.remaining, dartsLeft);
  if (!route) {
    return null;
  }
  return (
    <div className={`flex flex-1 flex-col items-center gap-2 px-5 py-3 ${card}`}>
      <span className={label}>{pl.checkout}</span>
      <span className="rounded-(--radius-chip) bg-(--color-accent) px-6 py-1 font-display text-(length:--text-checkout-fit) leading-none font-bold text-(--color-on-accent)">
        {route.map(hitLabel).join(' ')}
      </span>
      <span className="text-(--color-text-muted)">{`${pl.darts(route.length)} ${pl.toWinLeg}`}</span>
    </div>
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
