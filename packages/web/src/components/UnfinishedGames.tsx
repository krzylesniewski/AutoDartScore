import type { MatchListItem } from '@autoscore/schema';
import { formatActivity } from '../game/activity-date';
import { canAbandon } from '../game/can-abandon';
import { canEndPractice } from '../game/can-end-practice';
import { unfinishedRow } from '../game/unfinished-row';
import { pl } from '../i18n/pl';
import { Notice } from './Notice';
import { BustIcon, PauseIcon, StopIcon } from './icons';

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

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';

export function UnfinishedGames({ games, now, busy, notice, onFinish, onAbandon, onEndPractice }: UnfinishedGamesProps) {
  return (
    <section
      aria-labelledby="games-to-finish"
      className="flex flex-col gap-1.5 rounded-(--radius-panel) bg-(--color-surface-softer) pt-4 pr-3 pb-1.5 pl-5 shadow-(--shadow-inset-line) lg:min-h-0 lg:flex-1"
    >
      <div className="flex items-baseline justify-between gap-3 pr-2">
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
        <ul className="max-h-80 overflow-y-scroll pr-2 lg:max-h-none lg:min-h-0 lg:flex-1 [scrollbar-color:var(--color-border)_var(--color-surface-softer)]">
          {games.games.map((game) => {
            const row = unfinishedRow(game);
            return (
              <li key={game.id} className="flex flex-col gap-2 border-(--color-border) py-2.5 not-first:border-t">
                <div className="flex items-start gap-3.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="truncate text-[19px] font-semibold">{row.title}</div>
                    <div className="flex items-center gap-2 text-[15px] text-(--color-text-muted)">
                      {game.status === 'abandoned' && (
                        <span className="flex shrink-0 items-center gap-1 rounded-(--radius-pill) bg-(--color-surface-soft) px-2 py-0.5 font-display text-sm font-bold tracking-[0.06em] text-(--color-text) uppercase inset-ring-1 inset-ring-(--color-accent)">
                          <PauseIcon className="text-xs" />
                          {pl.statusAbandoned}
                        </span>
                      )}
                      <span className="truncate">{row.detail}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col text-right">
                    <span className="font-display text-[26px] leading-[1.1] font-bold whitespace-nowrap tabular-nums">{row.state}</span>
                    <time dateTime={game.updatedAt} className="text-sm whitespace-nowrap text-(--color-text-muted)">
                      {formatActivity(game.updatedAt, now)}
                    </time>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5">
                  <button type="button" aria-label={pl.finishGame(row.title)} disabled={busy} onClick={() => onFinish(game)} className="sc-btn h-11">
                    {pl.finish}
                  </button>
                  {canAbandon(game) && (
                    <button
                      type="button"
                      aria-label={pl.abandonGame(row.title)}
                      disabled={busy}
                      onClick={() => onAbandon(game)}
                      className="sc-btn sc-btn--outline sc-btn--icon"
                    >
                      <BustIcon className="text-(--color-text-sub)" />
                    </button>
                  )}
                  {canEndPractice(game) && (
                    <button
                      type="button"
                      aria-label={pl.endPracticeGame(row.title)}
                      disabled={busy}
                      onClick={() => onEndPractice(game)}
                      className="sc-btn sc-btn--outline sc-btn--quiet h-11"
                    >
                      <StopIcon />
                      {pl.endPractice}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
