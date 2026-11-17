import type { Fixture, FixtureSlot, TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { slotPlayer, slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { TrophyIcon } from './icons';
import { Notice } from './Notice';

export interface NextFixtureCardProps {
  view: TournamentView;
  busy: boolean;
  error: string | null;
  onPlay(fixture: Fixture): void;
}

function Side({ view, fixture, slot }: { view: TournamentView; fixture: Fixture; slot: FixtureSlot }) {
  const player = slotPlayer(view, slot);
  const standing = fixture.phase === 'group' && player ? view.standings.find((row) => row.playerId === player.id) : undefined;
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      {player && <Avatar name={player.name} avatar={player.avatar} color={player.color} size="large" />}
      <span className="max-w-full font-display text-[26px] leading-tight font-extrabold break-words">{slotText(view, slot)}</span>
      {standing && <span className="text-[13px] text-(--color-text-muted)">{pl.place(standing.place)}</span>}
    </span>
  );
}

export function NextFixtureCard({ view, busy, error, onPlay }: NextFixtureCardProps) {
  const titleId = useId();
  const fixture = view.fixtures.find((entry) => entry.id === view.nextFixtureId);

  if (view.status === 'finished') {
    return (
      <section className="sc-panel items-center gap-3 text-center">
        <TrophyIcon className="text-5xl text-(--color-gold)" />
        <h2 className="font-display text-[26px] font-extrabold">{pl.tournamentFinished}</h2>
      </section>
    );
  }

  if (!fixture) {
    return (
      <section aria-labelledby={titleId} className="sc-panel gap-2">
        <h2 id={titleId} className="font-display text-2xl font-extrabold">
          {pl.nextFixture}
        </h2>
        <p className="text-(--color-text-sub)">{pl.noReadyFixture}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} className="sc-panel gap-3.5 shadow-(--shadow-panel) inset-ring-2 inset-ring-(--color-accent)">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="font-display text-2xl font-extrabold">
          {pl.nextFixture}
        </h2>
        <span className="font-display text-xl font-extrabold text-(--color-text-muted) tabular-nums">{pl.fixtureHash(fixture.number)}</span>
      </div>
      <div className="flex items-center justify-between gap-2.5">
        <Side view={view} fixture={fixture} slot={fixture.slots[0]} />
        <span className="font-display text-[22px] font-extrabold text-(--color-text-muted)">{pl.versus}</span>
        <Side view={view} fixture={fixture} slot={fixture.slots[1]} />
      </div>
      <p className="text-center text-[15px] text-(--color-text-muted)">
        {pl.nextFixtureMeta(fixture.legsToWin, view.config.startingScore)}
      </p>
      {error && <Notice text={error} appearance="soft" />}
      <button type="button" disabled={busy} onClick={() => onPlay(fixture)} className="sc-btn sc-btn--primary h-16 w-full text-[26px]">
        {pl.playFixture}
      </button>
    </section>
  );
}
