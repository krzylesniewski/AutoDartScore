import type { TournamentView } from '@autoscore/schema';
import type { RunningLegs } from '../api/use-running-legs';
import { fixtureLabel, lowerFirst } from '../game/fixture-label';
import { slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { ThrowingIcon } from './icons';

export interface RunningFixturesProps {
  view: TournamentView;
  live: ReadonlyMap<string, RunningLegs>;
}

// Kilka meczów może trwać naraz, np. po porzuconym meczu. Ostatnio zaczęty idzie pierwszy.
export function RunningFixtures({ view, live }: RunningFixturesProps) {
  const running = view.fixtures
    .filter((fixture) => fixture.status === 'in_progress' && fixture.matchId !== null)
    .sort((first, second) => {
      if (first.id === view.liveFixtureId) {
        return -1;
      }
      if (second.id === view.liveFixtureId) {
        return 1;
      }
      return first.number - second.number;
    });
  if (running.length === 0) {
    return null;
  }
  return (
    <ul aria-label={pl.runningFixtures} className="flex flex-col gap-3">
      {running.map((fixture) => {
        const legs = live.get(fixture.id);
        return (
          <li key={fixture.id} className="sc-panel gap-3 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3 font-display text-lg font-extrabold">
              <span className="inline-flex min-w-0 items-center gap-2">
                <ThrowingIcon className="shrink-0 text-(--color-accent)" />
                {pl.runningFixture(lowerFirst(fixtureLabel(view.format, fixture)))}
              </span>
              <span className="text-(--color-text-muted) tabular-nums">{pl.fixtureHash(fixture.number)}</span>
            </div>
            <p className="flex items-center justify-between gap-3 font-display text-[22px] leading-tight font-bold">
              <span className="min-w-0 break-words">{slotText(view, fixture.slots[0])}</span>
              {legs ? (
                <span className="shrink-0 text-[34px] font-black tabular-nums">{pl.legsState(legs.legs[0], legs.legs[1])}</span>
              ) : (
                <span className="shrink-0 text-(--color-text-muted)">{pl.versus}</span>
              )}
              <span className="min-w-0 text-right break-words">{slotText(view, fixture.slots[1])}</span>
            </p>
            {legs && <p className="text-center text-[15px] text-(--color-text-muted)">{pl.legNumber(legs.legNumber)}</p>}
            <a href={`#/matches/${encodeURIComponent(fixture.matchId ?? '')}`} className="sc-btn sc-btn--outline w-full">
              {pl.backToMatch}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
