import type { FixtureSlot, PublicTournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { fixtureLabel } from '../game/fixture-label';
import { slotSourceText } from '../game/tournament-slot';
import { tvNextFixture } from '../game/tv-next-fixture';
import { pl } from '../i18n/pl';
import { TrophyIcon } from './icons';

export interface TvNextFixtureProps {
  view: PublicTournamentView;
}

export const TV_PANEL_TITLE = 'font-display text-lg font-bold tracking-[0.16em] text-(--color-text-muted) uppercase';

// Na ekranie obok trwa mecz, z którego przyjdzie gracz, więc „tego meczu” czyta się lepiej niż numer półfinału.
function sideText(view: PublicTournamentView, slot: FixtureSlot): string {
  if ((slot.kind === 'winner_of' || slot.kind === 'loser_of') && slot.fixtureId === view.liveFixtureId) {
    return slot.kind === 'winner_of' ? pl.slotWinnerOfThis : pl.slotLoserOfThis;
  }
  return slotSourceText(view, slot);
}

export function TvNextFixture({ view }: TvNextFixtureProps) {
  const titleId = useId();

  if (view.status === 'finished') {
    return (
      <section className="sc-panel shrink-0 flex-row items-center gap-3">
        <TrophyIcon className="text-4xl text-(--color-gold)" />
        <h2 className="font-display text-[30px] leading-tight font-extrabold">{pl.tournamentFinished}</h2>
      </section>
    );
  }

  const fixture = tvNextFixture(view);
  return (
    <section aria-labelledby={titleId} className="sc-panel sc-panel--flat shrink-0 gap-1.5">
      <h2 id={titleId} className={TV_PANEL_TITLE}>
        {pl.nextFixture}
      </h2>
      {fixture ? (
        <>
          <p className="font-display text-[30px] leading-tight font-extrabold break-words">
            {`${fixtureLabel(view.format, fixture)}: ${sideText(view, fixture.slots[0])} – ${sideText(view, fixture.slots[1])}`}
          </p>
          <p className="text-[17px] text-(--color-text-muted)">{pl.tableLegsMeta(fixture.legsToWin)}</p>
        </>
      ) : (
        <p className="text-lg text-(--color-text-sub)">{pl.noReadyFixture}</p>
      )}
    </section>
  );
}
