import type { MatchListItem } from '@autoscore/schema';
import { useId, type ReactNode } from 'react';
import { formatClock } from '../game/activity-date';
import { canAbandon } from '../game/can-abandon';
import { groupHistoryByDay } from '../game/history-days';
import { historyRow, type HistoryStatus } from '../game/history-row';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { BustIcon, PauseIcon, StopIcon, ThrowingIcon, TrophyIcon } from './icons';

export interface MatchHistoryListProps {
  games: readonly MatchListItem[];
  now: Date;
  // Bez onAbandon lista nie pokazuje przycisku porzucenia (np. gry gracza w statystykach).
  onAbandon?(game: MatchListItem): void;
  busy?: boolean;
  // Nagłówki dni i godzina przy każdej grze, jak na ekranie historii.
  groupByDay?: boolean;
}

const STATUS_ICONS: Record<HistoryStatus, ReactNode> = {
  finished: <TrophyIcon className="text-(--color-gold)" />,
  in_progress: <ThrowingIcon className="text-(--color-status-ok)" />,
  abandoned: <PauseIcon className="text-(--color-accent)" />,
  ended: <StopIcon className="text-(--color-text-muted)" />,
};

const dayLabel = 'ml-1 font-display text-[15px] font-bold tracking-[0.18em] text-(--color-text-muted) uppercase';
const link =
  'flex min-h-11 shrink-0 items-center gap-1.5 rounded-(--radius-button) bg-(--color-surface-soft) pr-3 pl-4.5 font-display text-[19px] font-semibold text-(--color-text) shadow-(--shadow-inset-line)';

function matchHref(id: string): string {
  return `#/matches/${encodeURIComponent(id)}`;
}

export function MatchHistoryList({ games, now, onAbandon, busy = false, groupByDay = false }: MatchHistoryListProps) {
  const id = useId();
  if (games.length === 0) {
    return <p className="py-3 font-display text-2xl text-(--color-text-muted)">{pl.noGamesInHistory}</p>;
  }
  const item = (game: MatchListItem) => <HistoryItem key={game.id} game={game} now={now} grouped={groupByDay} onAbandon={onAbandon} busy={busy} />;
  if (!groupByDay) {
    return <ul className="@container flex flex-col gap-2">{games.map(item)}</ul>;
  }
  // Grupy dni to sekcje z nagłówkiem, a nie zewnętrzna lista, więc jedynymi elementami list są wiersze gier.
  return (
    <div className="@container flex flex-col gap-(--space-6)">
      {groupHistoryByDay(games, now).map((day) => {
        const headingId = `${id}-${day.key}`;
        return (
          <section key={day.key} aria-labelledby={headingId} className="flex flex-col gap-2">
            <h2 id={headingId} className={dayLabel}>
              {day.label}
            </h2>
            <ul className="flex flex-col gap-2">{day.games.map(item)}</ul>
          </section>
        );
      })}
    </div>
  );
}

interface HistoryItemProps {
  game: MatchListItem;
  now: Date;
  grouped: boolean;
  onAbandon: ((game: MatchListItem) => void) | undefined;
  busy: boolean;
}

// Gra w trakcie ma tylko jaśniejsze tło karty. Stan niesie odznaka z ikoną i tekstem, bez kolorowej obwódki.
function HistoryItem({ game, now, grouped, onAbandon, busy }: HistoryItemProps) {
  const row = historyRow(game, now);
  const abandonable = onAbandon !== undefined && canAbandon(game);
  const when = grouped ? formatClock(game.updatedAt) : row.date;
  const surface = row.status === 'in_progress' ? 'bg-linear-to-r from-(--color-surface-raised) to-(--color-surface)' : 'bg-(--color-surface-softer)';
  return (
    <li
      className={`flex min-h-18 items-center gap-4 rounded-(--radius-card) py-2 pr-4 pl-5.5 shadow-(--shadow-inset-line) @xl:gap-5 @max-xl:grid @max-xl:grid-cols-[minmax(0,1fr)_auto] @max-xl:gap-x-3 @max-xl:gap-y-2 @max-xl:p-4 ${surface}`}
    >
      <time
        dateTime={game.updatedAt}
        className={`shrink-0 whitespace-nowrap tabular-nums @max-xl:hidden ${grouped ? 'w-16 font-display text-xl font-bold text-(--color-text-sub)' : 'w-24 text-[15px] text-(--color-text-muted)'}`}
      >
        {when}
      </time>
      {grouped && (
        <span aria-hidden="true" className="flex w-35 shrink-0 @max-xl:hidden">
          {game.players.map((player, index) => (
            <span key={player.id} className={`flex shrink-0 rounded-full ring-3 ring-(--color-bg-mid) ${index > 0 ? '-ml-2.5' : ''}`}>
              <Avatar name={player.name} avatar={player.avatar} color={player.color} size="medium" />
            </span>
          ))}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 @max-xl:col-span-2">
        <div className="truncate font-display text-[25px] leading-none font-bold">{row.result}</div>
        <div className="truncate text-sm text-(--color-text-muted)">
          {row.type}
          <span className="hidden @max-xl:inline">
            {' · '}
            <time dateTime={game.updatedAt}>{when}</time>
          </span>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-2 rounded-(--radius-pill) bg-(--color-surface-soft) px-3.5 py-2 font-display text-[17px] leading-tight font-bold whitespace-nowrap text-(--color-text) @max-xl:min-w-0 @max-xl:justify-self-start @max-xl:whitespace-normal @max-xl:wrap-anywhere">
        {STATUS_ICONS[row.status]}
        {row.statusLabel}
      </span>
      {/* W wąskiej karcie dwa przyciski schodzą do osobnego wiersza, żeby nie ściskać odznaki statusu. */}
      <div className={`flex shrink-0 items-center gap-3 @max-xl:justify-self-end ${abandonable ? '@max-xl:col-span-2' : ''}`}>
        {abandonable && (
          <button type="button" aria-label={pl.abandonGame(row.result)} disabled={busy} onClick={() => onAbandon(game)} className="sc-btn sc-btn--icon sc-btn--outline sc-btn--quiet shrink-0">
            <BustIcon />
          </button>
        )}
        {/* Puste miejsce na przycisk porzucenia, żeby linki „Szczegóły” stały w jednej kolumnie. */}
        {!abandonable && onAbandon !== undefined && <span aria-hidden="true" className="size-11 shrink-0 @max-xl:hidden" />}
        <a href={matchHref(game.id)} aria-label={pl.detailsOf(row.result)} className={link}>
          {pl.details}
          <span aria-hidden="true" className="text-(--color-text-sub)">
            ›
          </span>
        </a>
      </div>
    </li>
  );
}
