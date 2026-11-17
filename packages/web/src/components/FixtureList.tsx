import type { TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';

export interface FixtureListProps {
  view: TournamentView;
}

// Mecze poza grupą w kolejności gry, dopóki zakładka nie dostanie drabinki.
export function FixtureList({ view }: FixtureListProps) {
  const titleId = useId();
  const fixtures = view.fixtures.filter((fixture) => fixture.phase !== 'group').sort((first, second) => first.number - second.number);
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3">
      <h2 id={titleId} className="font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase">
        {pl.tournamentMatches}
      </h2>
      <ol className="flex flex-col gap-2">
        {fixtures.map((fixture) => (
          <li
            key={fixture.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-(--radius-card) bg-(--color-surface-softer) px-4 py-3 shadow-(--shadow-inset-line)"
          >
            <span className="w-20 shrink-0 font-display text-lg font-bold text-(--color-text-muted)">
              {pl.fixtureNumber(fixture.number)}
            </span>
            <span className="min-w-0 flex-1 basis-56 font-display text-xl font-bold break-words">
              {slotText(view, fixture.slots[0])} {pl.versus} {slotText(view, fixture.slots[1])}
            </span>
            {fixture.result && (
              <span className="font-display text-xl font-extrabold tabular-nums">
                {pl.legsState(fixture.result.legs[0], fixture.result.legs[1])}
              </span>
            )}
            <span className="text-(--color-text-sub)">{pl.fixtureStatus[fixture.status]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
