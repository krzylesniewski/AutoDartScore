import type { PublicTournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { formatAverage } from '../game/format-stat';
import { placeColor } from '../game/place-color';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface PublicPodiumProps {
  view: PublicTournamentView;
}

// Miejsca 1-3 z placements. Dzielone miejsce ma dwa wiersze z tym samym numerem. Średnia z tabeli grupy, więc w pucharze jej nie ma.
export function PublicPodium({ view }: PublicPodiumProps) {
  const titleId = useId();
  const players = new Map(view.players.map((player) => [player.id, player]));
  const averages = new Map(view.standings.map((row) => [row.playerId, row.average]));
  const rows = view.placements.filter((placement) => placement.place <= 3).sort((first, second) => first.place - second.place);
  return (
    <section aria-labelledby={titleId} className="sc-panel gap-1.5 px-4 py-4 sm:px-5.5">
      <h2 id={titleId} className="font-display text-[26px] leading-tight font-extrabold">
        {pl.tournamentPodium}
      </h2>
      <ol className="flex flex-col">
        {rows.map((row) => {
          const player = players.get(row.playerId);
          const average = averages.get(row.playerId) ?? null;
          return (
            <li
              key={`${row.place}-${row.playerId}`}
              className="flex min-h-15.5 items-center gap-3.5 border-t border-(--color-border-subtle) py-1.5"
            >
              <span className={`w-7 shrink-0 font-display text-[30px] font-black tabular-nums ${placeColor(row.place)}`}>
                {pl.placeNumber(row.place)}
              </span>
              {player && <Avatar name={player.name} avatar={player.avatar} color={player.color} size="medium" />}
              <span className="min-w-0 flex-1 truncate font-display text-2xl font-extrabold">{player?.name ?? ''}</span>
              {average !== null && (
                <span className="shrink-0 text-[15px] text-(--color-text-muted) tabular-nums">
                  {pl.averageShort(formatAverage(average))}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
