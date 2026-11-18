import type { Fixture, PublicTournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { fixtureLabel } from '../game/fixture-label';
import { publicMatchFixtures } from '../game/public-matches';
import { publicTournamentMatchHref } from '../game/tournament-match-href';
import { slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { Abbreviation } from './Abbreviation';

export interface PublicMatchListProps {
  view: PublicTournamentView;
}

const labelClass = 'font-display text-(length:--text-label) font-bold tracking-[0.14em] text-(--color-text-muted) uppercase';

// Legi wyniku turnieju w kolejności slotów, więc po korekcie wiersz pokazuje wynik poprawiony.
function MatchRow({ view, fixture }: { view: PublicTournamentView; fixture: Fixture }) {
  const running = fixture.status === 'in_progress';
  const { result } = fixture;
  return (
    <a
      href={publicTournamentMatchHref(view.id, fixture.matchId ?? '')}
      className="flex min-h-11 items-center gap-3 border-t border-(--color-border-subtle) py-2.5 text-(--color-text) no-underline"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={labelClass}>{fixtureLabel(view.format, fixture)}</span>
        {fixture.slots.map((slot, index) => {
          const winner = result !== null && slot.kind === 'player' && slot.playerId === result.winnerId;
          return (
            <span key={index} className="flex min-w-0 items-baseline gap-3">
              <span
                className={`min-w-0 flex-1 truncate font-display text-xl ${winner ? 'font-extrabold text-(--color-text)' : 'font-semibold text-(--color-text-sub)'}`}
              >
                {slotText(view, slot)}
                {winner && <span className="sr-only"> {pl.bracketWinner}</span>}
              </span>
              {result && (
                <span
                  className={`w-6 shrink-0 text-right font-display text-2xl tabular-nums ${winner ? 'font-black text-(--color-text)' : 'font-semibold text-(--color-text-muted)'}`}
                >
                  {result.legs[index]}
                </span>
              )}
            </span>
          );
        })}
      </span>
      {running && (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[15px] text-(--color-text)">
          <span aria-hidden="true" className="size-2 rounded-full bg-(--color-accent)" />
          {pl.tagLive}
        </span>
      )}
      {result?.corrected && (
        <span className="shrink-0 text-sm text-(--color-text-sub)">
          <Abbreviation short={pl.correctedShort} full={pl.correctedFull} />
        </span>
      )}
      <span aria-hidden="true" className="shrink-0 text-2xl leading-none text-(--color-text-muted)">
        ›
      </span>
    </a>
  );
}

export function PublicMatchList({ view }: PublicMatchListProps) {
  const titleId = useId();
  const fixtures = publicMatchFixtures(view);
  return (
    <section aria-labelledby={titleId} className="sc-panel min-w-0 gap-1.5 px-4 py-4 sm:px-5.5">
      <h2 id={titleId} className="flex flex-wrap items-baseline gap-x-2 font-display text-[26px] leading-tight font-extrabold">
        {pl.publicMatches} <span className="font-body text-[15px] font-normal text-(--color-text-muted)">· {pl.publicMatchesHint}</span>
      </h2>
      {fixtures.length === 0 ? (
        <p className="text-(--color-text-muted)">{pl.publicNoMatches}</p>
      ) : (
        <ul className="flex flex-col">
          {fixtures.map((fixture) => (
            <li key={fixture.id}>
              <MatchRow view={view} fixture={fixture} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
