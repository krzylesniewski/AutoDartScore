import type { MatchListItem } from '@autoscore/schema';
import { formatActivity } from '../game/activity-date';
import { canAbandon } from '../game/can-abandon';
import { canEndPractice } from '../game/can-end-practice';
import { unfinishedRow } from '../game/unfinished-row';
import { pl } from '../i18n/pl';
import { BustIcon, PauseIcon, WarningIcon } from './icons';

export type GameList = { status: 'loading' } | { status: 'error' } | { status: 'ready'; games: readonly MatchListItem[] };

export interface UnfinishedGamesProps {
  games: GameList;
  now: Date;
  busy: boolean;
  notice: string | null;
  onFinish(game: MatchListItem): void;
  onAbandon(game: MatchListItem): void;
  onEndPractice(game: MatchListItem): void;
}

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';
const button =
  'flex h-11 shrink-0 items-center rounded-(--radius-card) border-(length:--border-width) border-(--color-border-strong) bg-(--color-surface-button) px-4 font-display text-[19px] font-semibold disabled:opacity-40';
const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-transparent text-base text-(--color-text-muted) disabled:opacity-40';

export function UnfinishedGames({ games, now, busy, notice, onFinish, onAbandon, onEndPractice }: UnfinishedGamesProps) {
  return (
    <section
      aria-labelledby="games-to-finish"
      className="flex min-h-0 flex-1 flex-col gap-1.5 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) pt-6 pr-3 pb-3 pl-7"
    >
      <div className="flex items-baseline justify-between gap-3 pr-4">
        <h2 id="games-to-finish" className={label}>
          {games.status === 'ready' ? pl.gamesToFinishCount(games.games.length) : pl.gamesToFinish}
        </h2>
        <span className="text-[15px] text-(--color-text-muted)">{pl.newestFirst}</span>
      </div>
      {notice && <Notice text={notice} />}
      {games.status === 'loading' && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {games.status === 'error' && <Notice text={pl.loadMatchesFailed} />}
      {games.status === 'ready' && games.games.length === 0 && <p className="py-3 text-(--color-text-muted)">{pl.noGamesToFinish}</p>}
      {games.status === 'ready' && games.games.length > 0 && (
        <ul className="min-h-0 flex-1 overflow-y-scroll pr-4 [scrollbar-color:var(--color-border-strong)_var(--color-surface-header)]">
          {games.games.map((game) => {
            const row = unfinishedRow(game);
            return (
              <li key={game.id} className="flex items-center gap-3.5 border-b border-(--color-border) py-2.5 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[19px] font-semibold">{row.title}</div>
                  <div className="flex items-center gap-2 text-[15px] text-(--color-text-muted)">
                    {game.status === 'abandoned' && (
                      <span className="flex shrink-0 items-center gap-1 rounded-(--radius-chip) border border-(--color-accent) px-1.5 font-display text-sm font-semibold text-(--color-text) uppercase">
                        <PauseIcon className="text-(--color-accent)" />
                        {pl.statusAbandoned}
                      </span>
                    )}
                    <span className="truncate">{row.detail}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[26px] leading-tight font-bold whitespace-nowrap tabular-nums">{row.state}</div>
                  <time dateTime={game.updatedAt} className="text-sm whitespace-nowrap text-(--color-text-muted)">
                    {formatActivity(game.updatedAt, now)}
                  </time>
                </div>
                <button type="button" aria-label={pl.finishGame(row.title)} disabled={busy} onClick={() => onFinish(game)} className={button}>
                  {pl.finish}
                </button>
                {canAbandon(game) && (
                  <button type="button" aria-label={pl.abandonGame(row.title)} disabled={busy} onClick={() => onAbandon(game)} className={iconButton}>
                    <BustIcon />
                  </button>
                )}
                {canEndPractice(game) && (
                  <button type="button" aria-label={pl.endPracticeGame(row.title)} disabled={busy} onClick={() => onEndPractice(game)} className={button}>
                    {pl.endPractice}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 font-display text-lg text-(--color-accent)">
      <WarningIcon />
      {text}
    </p>
  );
}
