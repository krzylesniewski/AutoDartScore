import type { MatchSnapshot } from '@autoscore/schema';
import { NO_VALUE } from '../game/format-stat';
import { legStats } from '../game/leg-info';
import { pl } from '../i18n/pl';
import { BustIcon } from './icons';
import { StatTile } from './StatTile';
import { TurnHistory } from './TurnHistory';

export interface LegInfoProps {
  state: MatchSnapshot;
  id: string;
  className?: string | undefined;
  onClose?: (() => void) | undefined;
}

// Panel lega: historia tur i kafelki. Poniżej lg otwiera go przycisk „Tury” w nagłówku, a zamyka przycisk w panelu.
export function LegInfo({ state, id, className = '', onClose }: LegInfoProps) {
  if (state.practiceMode === 'checkouts') {
    return null;
  }
  const stats = legStats(state);
  const highest = stats.highest;
  const highestName = highest && state.players.length >= 2 ? (state.players.find((player) => player.id === highest.playerId)?.name ?? null) : null;
  const close = onClose && (
    // Ten sam krzyżyk co ikona bustu, jak w makiecie panelu na telefonie.
    <button type="button" onClick={onClose} className="sc-btn sc-btn--icon shrink-0 lg:hidden">
      <BustIcon />
      <span className="sr-only">{pl.closeTurnHistory}</span>
    </button>
  );
  return (
    <section id={id} className={`sc-panel sc-panel--flat gap-0 px-3 py-2 lg:px-4.5 lg:pt-3 lg:pb-3.5 ${className}`}>
      <TurnHistory state={state} action={close}>
        {state.practiceMode !== 'free_run' && (
          <div className="sc-tiles">
            <StatTile label={pl.tileHighestTurn} value={highest?.points ?? NO_VALUE} detail={highestName} />
            <StatTile label={pl.legDarts} value={stats.darts} />
            <StatTile label={pl.legBusts} value={stats.busts} icon={<BustIcon />} />
          </div>
        )}
      </TurnHistory>
    </section>
  );
}
