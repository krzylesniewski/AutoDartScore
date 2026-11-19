import type { Fixture, FixtureSlot, TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import { slotPlayer, slotText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { Notice } from './Notice';

export interface FixtureQueueProps {
  view: TournamentView;
  busy: boolean;
  error: string | null;
  onPlay(fixture: Fixture): void;
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

// Gotowe mecze poza następnym, więc każdy da się zagrać poza kolejnością.
export function FixtureQueue({ view, busy, error, onPlay }: FixtureQueueProps) {
  const titleId = useId();
  const queue = view.fixtures
    .filter((fixture) => fixture.status === 'ready' && fixture.id !== view.nextFixtureId)
    .sort((first, second) => first.number - second.number);
  if (queue.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-(--radius-panel) bg-(--color-surface-softer) px-4 py-4 shadow-(--shadow-inset-line) sm:px-5"
    >
      <h2 id={titleId} className="font-display text-(length:--text-label) font-bold tracking-[0.18em] text-(--color-text-muted) uppercase">
        {pl.fixtureQueue}
      </h2>
      {error && <Notice text={error} appearance="soft" />}
      <ol className="flex flex-col">
        {queue.map((fixture) => (
          <li
            key={fixture.id}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-(--color-border-subtle) py-1.5"
          >
            <span className="font-display text-lg font-extrabold text-(--color-text-muted) tabular-nums">
              {pl.fixtureHash(fixture.number)}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <Side view={view} slot={fixture.slots[0]} />
              <span className="text-sm text-(--color-text-muted)">{pl.versus}</span>
              <Side view={view} slot={fixture.slots[1]} />
            </span>
            <button
              type="button"
              disabled={busy}
              aria-label={pl.playFixtureNumber(fixture.number)}
              onClick={() => onPlay(fixture)}
              className="sc-btn sc-btn--outline h-11 px-4 text-lg"
            >
              {pl.play}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
