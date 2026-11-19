import { hitPoints } from '@autoscore/engine';
import { DARTS_PER_TURN, type Fixture, type MatchSnapshot, type MatchSnapshotPlayer, type MatchSummary } from '@autoscore/schema';
import { useId } from 'react';
import { checkoutRoute } from '../game/checkout-route';
import { formatAverage, NO_VALUE } from '../game/format-stat';
import { hitLabel } from '../game/hit-label';
import { lastTurnOf } from '../game/leg-info';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface TvLiveMatchProps {
  fixture: Fixture;
  state: MatchSnapshot | null;
  summary: MatchSummary | null;
}

// Rozmiary rosną z mniejszym z wymiarów okna (vw albo vh), więc panel mieści się bez przewijania od 1280×720 do 1920×1080.
// Wartości w środku clamp() to rozmiary z makiety 1600×900.
const LABEL = 'font-display text-[length:clamp(14px,min(1.1vw,2vh),20px)] font-bold tracking-[0.16em] text-(--color-text-muted) uppercase';
const SCORE = 'font-display text-[length:clamp(64px,min(11.9vw,21vh),240px)] leading-[0.85] font-black tabular-nums';
const LEGS = 'font-display text-[length:clamp(32px,min(4vw,7.1vh),80px)] leading-none font-black tabular-nums';
const NAME = 'min-w-0 truncate font-display text-[length:clamp(22px,min(2.9vw,5.1vh),56px)] leading-none font-extrabold';
const SLOT = 'h-[clamp(44px,7.1vh,76px)] w-[clamp(56px,5.6vw,104px)] shrink-0 rounded-(--radius-chip)';
const BIG = 'font-display text-[length:clamp(30px,min(3vw,5.3vh),56px)] leading-none font-black tabular-nums';

function lastTurnText(state: MatchSnapshot, playerId: string): string {
  const turn = lastTurnOf(state.legTurns, playerId);
  if (turn === null) {
    return NO_VALUE;
  }
  return turn.bust ? pl.tvLastTurnBust : String(turn.points);
}

interface PlayerCardProps {
  player: MatchSnapshotPlayer;
  state: MatchSnapshot;
  summary: MatchSummary | null;
  thrower: boolean;
}

function PlayerCard({ player, state, summary, thrower }: PlayerCardProps) {
  const average = summary ? formatAverage(summary.players.find((line) => line.playerId === player.id)?.average ?? null) : NO_VALUE;
  return (
    <div
      role="group"
      aria-label={player.name}
      className={`sc-panel min-h-0 flex-1 flex-row flex-wrap items-center gap-[clamp(12px,1.75vw,28px)] px-[clamp(16px,2.1vw,34px)] py-3 sm:flex-nowrap ${thrower ? 'shadow-(--shadow-panel) inset-ring-2 inset-ring-(--color-accent)' : ''}`}
    >
      <Avatar name={player.name} avatar={player.avatar} color={player.color} size="tv" current={thrower} />
      {/* Na telefonie legi i wynik schodzą do drugiego rzędu, żeby imię miało całą szerokość obok avatara. */}
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5 sm:basis-0">
        <span className="flex min-w-0 flex-wrap items-center gap-x-[clamp(8px,0.9vw,14px)] gap-y-1">
          <span className={`${NAME} max-w-full`}>{player.name}</span>
          {thrower && (
            <span className="shrink-0 rounded-(--radius-pill) bg-(--color-accent) px-3 py-1 font-display text-[length:clamp(14px,min(1.15vw,2vh),20px)] leading-none font-extrabold tracking-[0.1em] text-(--color-on-accent) uppercase">
              {pl.throwing}
            </span>
          )}
        </span>
        <span className="text-[length:clamp(14px,min(1.25vw,2.2vh),24px)] text-(--color-text-muted) tabular-nums">
          {pl.tvPlayerLine(average, lastTurnText(state, player.id))}
        </span>
      </div>
      <div className="flex w-[clamp(56px,7.5vw,128px)] shrink-0 flex-col items-center gap-1 max-sm:ml-auto">
        <span className={LABEL}>{pl.legs}</span>
        <span className={LEGS}>{player.legsWon ?? 0}</span>
      </div>
      <span className={`${SCORE} shrink-0 text-right max-sm:ml-auto ${thrower ? 'text-(--color-text)' : 'text-(--color-text-sub)'}`}>
        {player.remaining}
      </span>
    </div>
  );
}

function slotPlayers(fixture: Fixture, state: MatchSnapshot): MatchSnapshotPlayer[] {
  return fixture.slots.flatMap((slot) => {
    const found = slot.kind === 'player' ? state.players.find((entry) => entry.id === slot.playerId) : undefined;
    return found ? [found] : [];
  });
}

export function TvLiveMatch({ fixture, state, summary }: TvLiveMatchProps) {
  const checkoutId = useId();

  if (state === null) {
    return (
      <section aria-label={pl.tvRunningMatch} className="min-w-0">
        <p className="text-(--color-text-muted)">{pl.loading}</p>
      </section>
    );
  }

  // Karty stoją w kolejności slotów i się nie zamieniają, żeby widz z daleka zawsze szukał gracza w tym samym miejscu.
  const throwerId = state.status === 'in_progress' ? state.currentPlayerId : null;
  const route = throwerId === null ? null : checkoutRoute(state);
  const total = state.currentDarts.reduce((sum, dart) => sum + hitPoints(dart), 0);
  const empty = Math.max(DARTS_PER_TURN - state.currentDarts.length, 0);

  return (
    <section aria-label={pl.tvRunningMatch} className="flex min-h-0 min-w-0 flex-col gap-(--space-6)">
      <div className="flex min-h-0 flex-1 flex-col gap-(--space-6)">
        {slotPlayers(fixture, state).map((player) => (
          <PlayerCard key={player.id} player={player} state={state} summary={summary} thrower={player.id === throwerId} />
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap gap-(--space-6)">
        <div className="sc-panel sc-panel--flat min-w-0 flex-auto flex-row flex-wrap items-center gap-(--space-6) px-6 py-[clamp(10px,2vh,18px)]">
          <span className={LABEL}>{pl.tvThisTurn}</span>
          <span className="flex gap-2.5">
            {state.currentDarts.map((dart, index) => (
              <span
                key={index}
                className={`sc-slot sc-slot--filled ${SLOT} font-display text-[length:clamp(24px,min(2.1vw,3.8vh),40px)] font-black`}
              >
                {hitLabel(dart)}
              </span>
            ))}
            {Array.from({ length: empty }, (_, index) => (
              <span key={`empty-${index}`} aria-hidden="true" className={`${SLOT} border-2 border-dashed border-(--color-border)`} />
            ))}
          </span>
          <span aria-hidden="true" className="grow" />
          <span className={BIG}>{total}</span>
        </div>
        <div
          role="group"
          aria-labelledby={checkoutId}
          className="sc-checkout flex min-w-0 flex-auto flex-wrap items-center gap-x-4 gap-y-1 px-6 py-[clamp(10px,2vh,18px)]"
        >
          <span
            id={checkoutId}
            className="font-display text-[length:clamp(14px,min(1.1vw,2vh),20px)] font-bold tracking-[0.16em] uppercase"
          >
            {pl.checkout}
          </span>
          <span className={BIG}>{route ? route.map(hitLabel).join(' · ') : NO_VALUE}</span>
        </div>
      </div>
    </section>
  );
}
