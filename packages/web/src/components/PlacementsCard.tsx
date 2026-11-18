import type { TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { placeColor } from '../game/place-color';
import { placementRows } from '../game/placement-rows';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface PlacementsCardProps {
  view: TournamentView;
}

// W trakcie turnieju tylko znane miejsca i te, o których rozstrzygnie jeszcze konkretny mecz.
export function PlacementsCard({ view }: PlacementsCardProps) {
  const titleId = useId();
  const rows = placementRows(view);
  if (rows.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-1.5 rounded-(--radius-panel) bg-(--color-surface-softer) px-4 py-4 shadow-(--shadow-inset-line) sm:px-5"
    >
      <h2 id={titleId} className="font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase">
        {pl.finalPlacements}
      </h2>
      <ol className="flex flex-col">
        {rows.map((row, index) => {
          const player = row.playerId === null ? undefined : view.players.find((entry) => entry.id === row.playerId);
          return (
            <li
              key={`${row.place}-${row.playerId ?? index}`}
              className="flex min-h-12.5 items-center gap-3 border-t border-(--color-border-subtle) py-1.5"
            >
              <span className={`w-8.5 shrink-0 font-display text-2xl font-black tabular-nums ${placeColor(row.place)}`}>
                {pl.placeNumber(row.place)}
              </span>
              {row.playerId === null ? (
                <span className="min-w-0 flex-1 font-display text-xl font-bold text-(--color-text-muted)">{row.text}</span>
              ) : (
                <>
                  {player && <Avatar name={player.name} avatar={player.avatar} color={player.color} size="small" />}
                  <span className="min-w-0 flex-1 truncate font-display text-xl font-bold">{player?.name ?? pl.slotPending}</span>
                  {row.text && <span className="shrink-0 text-[13px] text-(--color-text-muted)">{row.text}</span>}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
