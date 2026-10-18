import { hitPoints } from '@autoscore/engine';
import type { Hit, MatchSnapshot } from '@autoscore/schema';
import type { LastTurn } from '../api/use-match';
import { suggestCheckout } from '../game/checkout';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { BustIcon } from './icons';

const DARTS_PER_TURN = 3;

export interface TurnPanelProps {
  state: MatchSnapshot;
  lastTurn: LastTurn | null;
  busy: boolean;
  onUndo(): void;
}

export function TurnPanel({ state, lastTurn, busy, onUndo }: TurnPanelProps) {
  // Pusta tura zaraz po zamknięciu pokazuje ostatnią turę, dopóki nie przyjdzie kolejna zmiana stanu.
  const shown = state.currentDarts.length === 0 && lastTurn?.eventSeq === state.eventSeq ? lastTurn : null;
  const darts: readonly Hit[] = shown ? shown.darts : state.currentDarts;
  const shownName = shown ? state.players.find((player) => player.id === shown.playerId)?.name : undefined;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <ol className={`grid flex-1 grid-cols-3 gap-2 ${shown ? 'opacity-50' : ''}`}>
          {Array.from({ length: DARTS_PER_TURN }, (_, index) => {
            const dart = darts[index];
            return (
              <li
                key={index}
                aria-label={pl.dartSlot(index + 1)}
                className="flex h-20 items-center justify-center rounded-card border border-line bg-surface font-display text-4xl font-bold"
              >
                {dart ? hitLabel(dart) : ''}
              </li>
            );
          })}
        </ol>
        <div className="flex w-32 flex-col items-end font-display">
          <span className="text-sm uppercase text-muted">{pl.turnTotal}</span>
          <TurnTotal darts={darts} shown={shown} />
        </div>
      </div>
      {shownName && <p className="font-display text-lg text-muted">{shownName}</p>}
      <CheckoutHint state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={busy}
          className="min-h-12 rounded-card border border-line bg-surface-raised px-5 font-display text-xl uppercase disabled:opacity-40"
        >
          {pl.undo}
        </button>
        <SoonButton label={pl.nextRound} />
        <SoonButton label={pl.toReview} />
      </div>
    </section>
  );
}

function TurnTotal({ darts, shown }: { darts: readonly Hit[]; shown: LastTurn | null }) {
  if (shown?.bust) {
    return (
      <span className="flex items-center gap-1 text-4xl font-bold text-board-red">
        <BustIcon />
        {pl.bust}
      </span>
    );
  }
  const total = shown?.total ?? darts.reduce((sum, dart) => sum + hitPoints(dart), 0);
  return <span className="text-5xl font-bold tabular-nums">{total}</span>;
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
    <div className="flex items-baseline gap-3 rounded-card border-l-4 border-board-green bg-surface px-4 py-2 font-display">
      <span className="text-sm uppercase text-muted">{pl.checkout}</span>
      <span className="text-3xl font-bold">{route.map(hitLabel).join(' ')}</span>
      <span className="text-muted">{pl.darts(route.length)}</span>
    </div>
  );
}

function SoonButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-12 flex-col items-start justify-center rounded-card border border-line bg-surface px-5 font-display text-xl uppercase text-muted"
    >
      {label}
      <span className="text-xs normal-case">{pl.soon}</span>
    </button>
  );
}
