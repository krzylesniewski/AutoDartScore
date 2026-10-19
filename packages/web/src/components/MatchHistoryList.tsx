import type { MatchListItem } from '@autoscore/schema';
import type { ReactNode } from 'react';
import { historyRow, type HistoryStatus } from '../game/history-row';
import { pl } from '../i18n/pl';
import { PauseIcon, StopIcon, ThrowingIcon, TrophyIcon } from './icons';

export interface MatchHistoryListProps {
  games: readonly MatchListItem[];
  now: Date;
}

const STATUS_ICONS: Record<HistoryStatus, ReactNode> = {
  finished: <TrophyIcon className="text-(--color-accent)" />,
  in_progress: <ThrowingIcon className="text-(--color-status-ok)" />,
  abandoned: <PauseIcon className="text-(--color-accent)" />,
  ended: <StopIcon className="text-(--color-text-muted)" />,
};

const link =
  'flex min-h-11 shrink-0 items-center rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 font-display text-[19px] font-semibold';

function matchHref(id: string): string {
  return `#/matches/${encodeURIComponent(id)}`;
}

export function MatchHistoryList({ games, now }: MatchHistoryListProps) {
  if (games.length === 0) {
    return <p className="py-3 font-display text-2xl text-(--color-text-muted)">{pl.noGamesInHistory}</p>;
  }
  return (
    <ul className="@container flex flex-col">
      {games.map((game) => {
        const row = historyRow(game, now);
        return (
          <li
            key={game.id}
            className="flex items-center gap-4 border-b border-(--color-border) py-3 last:border-b-0 @max-xl:grid @max-xl:grid-cols-[minmax(0,1fr)_auto] @max-xl:gap-x-3 @max-xl:gap-y-2"
          >
            <time dateTime={game.updatedAt} className="w-24 shrink-0 text-[15px] whitespace-nowrap text-(--color-text-muted) @max-xl:hidden">
              {row.date}
            </time>
            <div className="min-w-0 flex-1 @max-xl:col-span-2">
              <div className="truncate text-[19px] font-semibold">{row.result}</div>
              <div className="truncate text-[15px] text-(--color-text-muted)">
                {row.type}
                <span className="hidden @max-xl:inline">
                  {' · '}
                  <time dateTime={game.updatedAt}>{row.date}</time>
                </span>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-(--radius-chip) border border-(--color-border-strong) px-2 py-0.5 font-display text-base font-semibold text-(--color-text) uppercase @max-xl:min-w-0 @max-xl:justify-self-start @max-xl:wrap-anywhere">
              {STATUS_ICONS[row.status]}
              {row.statusLabel}
            </span>
            <a href={matchHref(game.id)} aria-label={pl.detailsOf(row.result)} className={`${link} @max-xl:justify-self-end`}>
              {pl.details}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
