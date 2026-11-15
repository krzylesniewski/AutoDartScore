import { hitPoints } from '@autoscore/engine';
import type { Hit, MatchSnapshot } from '@autoscore/schema';
import type { LastTurn } from '../api/use-match';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { BustIcon, TargetIcon } from './icons';

const DARTS_PER_TURN = 3;

export interface TurnPanelProps {
  state: MatchSnapshot;
  lastTurn: LastTurn | null;
}

// Stała wysokość w każdym stanie, bo od lg klawiatura stoi tuż pod panelem i nie może skakać.
export function TurnPanel({ state, lastTurn }: TurnPanelProps) {
  // Pusta tura zaraz po zamknięciu pokazuje ostatnią turę, dopóki nie przyjdzie kolejna zmiana stanu.
  const shown = state.currentDarts.length === 0 && lastTurn?.eventSeq === state.eventSeq ? lastTurn : null;
  const darts: readonly Hit[] = shown ? shown.darts : state.currentDarts;
  const shownName = shown ? state.players.find((player) => player.id === shown.playerId)?.name : undefined;
  const thrower = state.finished ? undefined : state.players.find((player) => player.id === state.currentPlayerId);
  const waitingIndex = thrower && !shown ? darts.length : -1;
  const total = shown?.total ?? darts.reduce((sum, dart) => sum + hitPoints(dart), 0);

  return (
    <section className="@container flex h-[60px] shrink-0 gap-1.5 lg:h-[120px] lg:gap-(--space-5)">
      <ol className={`grid min-w-0 flex-1 grid-cols-3 gap-1.5 lg:gap-(--space-5) ${shown ? 'opacity-50' : ''}`}>
        {Array.from({ length: DARTS_PER_TURN }, (_, index) => (
          <DartSlot key={index} index={index} dart={darts[index]} waiting={index === waitingIndex} />
        ))}
      </ol>
      <div className="flex w-[78px] shrink-0 flex-col items-end justify-center lg:w-[150px]">
        <span className="max-w-full truncate text-[13px] leading-tight text-(--color-text-muted) lg:text-[15px]">{shownName ?? pl.thisTurn}</span>
        {shown?.bust ? (
          <span className="flex items-center gap-1 font-display text-[22px] leading-none font-extrabold lg:gap-2 lg:text-[clamp(32px,4.4cqi,44px)]">
            <BustIcon className="text-(--color-accent)" />
            {pl.bust}
          </span>
        ) : (
          <span className="font-display text-[38px] leading-none font-extrabold tabular-nums lg:text-[clamp(48px,7.2cqi,72px)]">{total}</span>
        )}
      </div>
    </section>
  );
}

function DartSlot({ index, dart, waiting }: { index: number; dart: Hit | undefined; waiting: boolean }) {
  const label = pl.dartSlot(index + 1);
  if (dart) {
    return (
      <li aria-label={label} className="sc-slot sc-slot--filled">
        <span className="font-display text-[clamp(22px,7cqi,30px)] leading-none font-extrabold lg:text-[clamp(36px,5.6cqi,56px)]">{hitLabel(dart)}</span>
        <span className="text-[11px] leading-none text-(--color-text-muted) lg:text-sm">{hitPoints(dart)}</span>
      </li>
    );
  }

  if (waiting) {
    return (
      <li aria-label={label} className="sc-slot sc-slot--active px-1 text-center 2xl:flex-row 2xl:gap-(--space-5)">
        <TargetIcon className="text-lg text-(--color-accent) lg:text-[32px] 2xl:text-[40px]" />
        <span className="text-[13px] leading-tight text-(--color-text-sub) lg:text-[15px] 2xl:text-[17px]">{pl.waitingForDart}</span>
      </li>
    );
  }

  return (
    <li aria-label={label} className="sc-slot">
      <span className="text-[13px] leading-tight text-(--color-text-muted) lg:text-[15px]">{label}</span>
    </li>
  );
}
