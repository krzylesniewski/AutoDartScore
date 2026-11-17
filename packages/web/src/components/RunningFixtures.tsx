import type { TournamentView } from '@autoscore/schema';
import { slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { ThrowingIcon } from './icons';

export interface RunningFixturesProps {
  view: TournamentView;
}

// Kilka meczów może trwać naraz, np. po porzuconym meczu. Ostatnio zaczęty idzie pierwszy.
export function RunningFixtures({ view }: RunningFixturesProps) {
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
      {running.map((fixture) => (
        <li key={fixture.id} className="sc-panel gap-3 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 font-display text-lg font-extrabold">
            <span className="inline-flex items-center gap-2 tracking-[0.12em] uppercase">
              <ThrowingIcon className="text-(--color-accent)" />
              {pl.fixtureRunning}
            </span>
            <span className="text-(--color-text-muted) tabular-nums">{pl.fixtureHash(fixture.number)}</span>
          </div>
          <p className="font-display text-[22px] leading-tight font-bold break-words">
            {slotText(view, fixture.slots[0])} {pl.versus} {slotText(view, fixture.slots[1])}
          </p>
          <a href={`#/matches/${encodeURIComponent(fixture.matchId ?? '')}`} className="sc-btn sc-btn--outline w-full">
            {pl.backToMatch}
          </a>
        </li>
      ))}
    </ul>
  );
}
