import type { MatchSnapshot, MatchSummary } from '@autoscore/schema';
import { useId } from 'react';
import { casualPlaces } from '../game/casual-places';
import { formatAverage } from '../game/format-stat';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { GameTime } from './GameTime';
import { TrophyIcon } from './icons';

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-sub)';

export interface CasualRankingCardProps {
  state: MatchSnapshot;
  summary: MatchSummary | null; // null, dopóki nie ma podsumowania tak świeżego jak stan
}

export function CasualRankingCard({ state, summary }: CasualRankingCardProps) {
  const headingId = useId();
  const [first, ...others] = casualPlaces(state, summary);

  return (
    <section aria-labelledby={headingId} className="sc-panel items-center gap-5 px-4 text-center sm:px-5.5">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full max-h-96 bg-(image:--gradient-winner-halo)" />
      <h2 id={headingId} className={`relative ${label}`}>
        {pl.casualRankingTitle}
      </h2>
      {first && (
        <div className="relative flex max-w-full flex-col items-center gap-3">
          <span className="inline-flex rounded-full shadow-(--shadow-winner-avatar)">
            <Avatar name={first.player.name} avatar={first.player.avatar} color={first.player.color} size="preview" />
          </span>
          <p className="inline-flex items-center gap-2 rounded-(--radius-pill) bg-(--color-route-chip) px-4 py-1 font-display text-[21px] font-extrabold text-(--color-gold)">
            <TrophyIcon />
            {pl.place(first.place)}
          </p>
          <p className="max-w-full font-display text-[length:clamp(2.25rem,5vw,3.5rem)] leading-tight font-black break-words">{first.player.name}</p>
          {first.line && (
            <p className="text-[15px] text-(--color-text-sub)">
              {`${pl.placeDetail(first.line.dartsThrown, first.line.highestCheckout, first.player.remaining ?? 0)} · ${pl.averageShort(formatAverage(first.line.average))}`}
            </p>
          )}
        </div>
      )}
      {others.length > 0 && (
        <ol aria-label={pl.otherPlaces} className="relative flex w-full flex-col gap-2 text-left">
          {others.map(({ place, player, line }) => (
            <li
              key={player.id}
              className="flex min-h-18 items-center gap-2 rounded-(--radius-card) bg-(--color-surface-softer) px-3 py-2 shadow-(--shadow-inset-line) sm:gap-3 sm:px-4.5"
            >
              <span className="w-7 shrink-0 sm:w-9 font-display text-[30px] leading-none font-black text-(--color-text-sub)">{pl.placeNumber(place)}</span>
              <Avatar name={player.name} avatar={player.avatar} color={player.color} size="tile" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-display text-[27px] leading-tight font-bold">{player.name}</span>
                {line && <span className="text-sm text-(--color-text-muted)">{pl.placeDetail(line.dartsThrown, line.highestCheckout, player.remaining ?? 0)}</span>}
              </div>
              {line && (
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">{formatAverage(line.average)}</span>
                  <span className="text-[13px] text-(--color-text-muted) lowercase">{pl.average}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <GameTime state={state} className="relative mt-auto" />
    </section>
  );
}
