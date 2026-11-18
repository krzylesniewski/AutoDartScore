import type { Fixture, TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { useRunningLegs, type RunningLegs } from '../api/use-running-legs';
import { fixtureLabel } from '../game/fixture-label';
import { slotSourceText } from '../game/tournament-slot';
import { tvBracketRows } from '../game/tv-bracket-rows';
import { pl } from '../i18n/pl';
import { Abbreviation } from './Abbreviation';
import { ThrowingIcon } from './icons';
import { TV_PANEL_TITLE } from './TvNextFixture';

export interface TvBracketListProps {
  view: TournamentView;
}

const NO_LEGS = '–';

function Legs({ fixture, live }: { fixture: Fixture; live: ReadonlyMap<string, RunningLegs> }) {
  if (fixture.result && (fixture.status === 'finished' || fixture.status === 'walkover')) {
    return (
      <>
        {pl.legsState(...fixture.result.legs)}
        {fixture.status === 'walkover' && (
          <span className="ml-1.5 text-sm font-semibold text-(--color-text-muted)">
            <Abbreviation short={pl.walkoverShort} full={pl.tagWalkover} />
          </span>
        )}
        {fixture.status === 'finished' && fixture.result.corrected && (
          <span className="ml-1.5 text-sm font-semibold text-(--color-text-muted)">
            <Abbreviation short={pl.correctedShort} full={pl.correctedFull} />
          </span>
        )}
      </>
    );
  }
  const running = fixture.status === 'in_progress' ? live.get(fixture.id) : undefined;
  return running ? pl.legsState(...running.legs) : NO_LEGS;
}

export function TvBracketList({ view }: TvBracketListProps) {
  const titleId = useId();
  const live = useRunningLegs(view);
  const rows = tvBracketRows(view);
  return (
    <section aria-labelledby={titleId} className="sc-panel shrink-0 gap-2.5">
      <h2 id={titleId} className={TV_PANEL_TITLE}>
        {view.format === 'cup' ? pl.tabBracket : pl.tabPlayoff}
      </h2>
      <ul className="flex flex-col gap-1">
        {rows.map((fixture) => {
          const current = fixture.id === view.liveFixtureId;
          return (
            <li
              key={fixture.id}
              className={`flex min-h-[50px] items-center gap-2.5 rounded-(--radius-chip) px-3 py-1 ${current ? 'bg-(--color-surface-soft) inset-ring-2 inset-ring-(--color-accent)' : ''}`}
            >
              <span className="flex w-28 shrink-0 flex-col text-[15px] leading-tight text-(--color-text-muted)">
                {fixtureLabel(view.format, fixture)}
                {current && (
                  <span className="inline-flex items-center gap-1 font-semibold text-(--color-text)">
                    <ThrowingIcon className="shrink-0 text-(--color-accent)" />
                    {pl.tagLive}
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-display text-[22px] font-bold">
                {`${slotSourceText(view, fixture.slots[0])} – ${slotSourceText(view, fixture.slots[1])}`}
              </span>
              <span className="shrink-0 font-display text-2xl font-black whitespace-nowrap tabular-nums">
                <Legs fixture={fixture} live={live} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
