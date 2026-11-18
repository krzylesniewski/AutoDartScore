import type { FixtureSlot, TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { tournamentMatchHref } from '../game/tournament-match-href';
import { slotPlayer, slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { Abbreviation } from './Abbreviation';
import { Avatar } from './Avatar';

export interface PlayedFixturesProps {
  view: TournamentView;
}

function Side({ view, slot }: { view: TournamentView; slot: FixtureSlot }) {
  const player = slotPlayer(view, slot);
  return (
    <span className="flex min-w-0 items-center gap-2">
      {player && <Avatar name={player.name} avatar={player.avatar} color={player.color} size="small" />}
      <span className="min-w-0 truncate font-display text-[19px] font-bold">{slotText(view, slot)}</span>
    </span>
  );
}

// Zakończone mecze od ostatnio rozegranego, z wynikiem turnieju w kolejności slotów. Walkowery bez rzutek tu nie trafiają.
export function PlayedFixtures({ view }: PlayedFixturesProps) {
  const titleId = useId();
  const played = view.fixtures
    .filter((fixture) => fixture.status === 'finished' && fixture.matchId !== null)
    .sort((first, second) => second.number - first.number);
  if (played.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-(--radius-panel) bg-(--color-surface-softer) px-4 py-4 shadow-(--shadow-inset-line) sm:px-5"
    >
      <h2 id={titleId} className="font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase">
        {pl.playedFixtures}
      </h2>
      <ol className="flex flex-col">
        {played.map((fixture) => (
          <li
            key={fixture.id}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-(--color-border-subtle) py-1.5"
          >
            <span className="font-display text-lg font-extrabold text-(--color-text-muted) tabular-nums">
              {pl.fixtureHash(fixture.number)}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <Side view={view} slot={fixture.slots[0]} />
              {fixture.result && (
                <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="font-display text-[19px] font-black tabular-nums">
                    {pl.legsState(fixture.result.legs[0], fixture.result.legs[1])}
                  </span>
                  {fixture.result.corrected && (
                    <span className="text-xs text-(--color-text-sub)">
                      <Abbreviation short={pl.correctedShort} full={pl.correctedFull} />
                    </span>
                  )}
                </span>
              )}
              <Side view={view} slot={fixture.slots[1]} />
            </span>
            <a
              href={tournamentMatchHref(view.id, fixture.matchId ?? '')}
              aria-label={pl.fixtureDetails(fixture.number)}
              className="inline-flex min-h-11 items-center px-2 text-lg text-(--color-text) underline underline-offset-4"
            >
              {pl.details}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
