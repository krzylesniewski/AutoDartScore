import type { Fixture, MatchSnapshot, MatchSnapshotPlayer } from '@autoscore/schema';
import { formatClock } from '../game/activity-date';
import { gameElapsedMs } from '../game/leg-clock';
import { headerResult } from '../game/tournament-match-result';
import { formatDay } from '../game/tournament-setup';
import { pl } from '../i18n/pl';
import { Abbreviation } from './Abbreviation';
import { Avatar } from './Avatar';
import { TrophyIcon } from './icons';

export interface TournamentMatchHeaderProps {
  state: MatchSnapshot;
  fixture: Fixture | undefined;
}

const MARKS = {
  corrected: { short: pl.correctedShort, full: pl.correctedFull },
  walkover: { short: pl.walkoverShort, full: pl.tagWalkover },
} as const;

// Etykiety grupy i ligi mają już numer meczu („Liga, mecz 7”), a pozostałe dostają go po kropce.
function labelLine(state: MatchSnapshot, fixture: Fixture | undefined): string {
  const label = state.tournament?.label ?? '';
  return fixture && fixture.phase !== 'group' ? `${label} · ${pl.fixtureTagNumber(fixture.number)}` : label;
}

function dateLine(state: MatchSnapshot): string {
  const start = state.startedAt ?? state.createdAt;
  const day = `${formatDay(new Date(start))} · ${formatClock(start)}`;
  const elapsed = gameElapsedMs(state);
  return elapsed === null ? day : `${day} · ${pl.matchMinutes(Math.max(1, Math.round(elapsed / 60000)))}`;
}

function PlayerSide({ player, winner }: { player: MatchSnapshotPlayer | undefined; winner: boolean }) {
  if (!player) {
    return <span className="min-w-0 flex-1" />;
  }
  return (
    <span className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {winner ? (
        <span className="flex shrink-0 rounded-full ring-2 ring-(--color-gold) ring-offset-4 ring-offset-(--color-surface-raised)">
          <Avatar name={player.name} avatar={player.avatar} color={player.color} size="large" />
        </span>
      ) : (
        <Avatar name={player.name} avatar={player.avatar} color={player.color} size="large" />
      )}
      <span className="flex w-full min-w-0 items-center justify-center gap-1.5">
        {winner && <TrophyIcon className="shrink-0 text-(--color-gold)" />}
        <span
          className={`min-w-0 truncate font-display text-xl leading-tight sm:text-2xl ${winner ? 'font-extrabold text-(--color-text)' : 'font-bold text-(--color-text-sub)'}`}
        >
          {player.name}
        </span>
        {winner && <span className="sr-only">{pl.bracketWinner}</span>}
      </span>
    </span>
  );
}

function StatusTag({ state, walkover }: { state: MatchSnapshot; walkover: boolean }) {
  if (state.status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-2 text-[15px] text-(--color-text)">
        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-(--color-accent)" />
        {pl.tagLiveLeg(state.legIndex + 1)}
      </span>
    );
  }
  if (state.status === 'abandoned' && !walkover) {
    return <span className="text-[15px] text-(--color-text-muted)">{pl.statusAbandoned}</span>;
  }
  return null;
}

export function TournamentMatchHeader({ state, fixture }: TournamentMatchHeaderProps) {
  const result = headerResult(state, fixture);
  const running = state.status === 'in_progress';
  const winnerId = running ? null : result.winnerId;
  const [first, second] = state.players;
  return (
    <header className="sc-panel min-w-0 gap-4 px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] lg:items-center lg:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="font-display text-(length:--text-label) font-bold tracking-[0.18em] break-words text-(--color-text-muted) uppercase">
          {labelLine(state, fixture)}
        </h1>
        {state.legsToWin !== null && state.startingScore !== null && (
          <p className="text-[15px] text-(--color-text-sub)">{pl.matchPageMeta(state.legsToWin, state.startingScore)}</p>
        )}
      </div>
      <div className="flex min-w-0 items-center justify-center gap-3 sm:gap-6">
        <PlayerSide player={first} winner={first !== undefined && first.id === winnerId} />
        <div className="flex shrink-0 flex-col items-center gap-1">
          <p className="font-display text-[length:clamp(2.75rem,10vw,4.5rem)] leading-none font-black whitespace-nowrap tabular-nums">
            {pl.legsState(result.legs[0], result.legs[1])}
          </p>
          {result.mark && (
            <span className="text-sm text-(--color-text-sub)">
              <Abbreviation short={MARKS[result.mark].short} full={MARKS[result.mark].full} />
            </span>
          )}
          {result.played && (
            <span className="text-sm whitespace-nowrap text-(--color-text-muted) tabular-nums">
              {pl.playedResult(result.played[0], result.played[1])}
            </span>
          )}
          <StatusTag state={state} walkover={result.mark === 'walkover'} />
        </div>
        <PlayerSide player={second} winner={second !== undefined && second.id === winnerId} />
      </div>
      <p className="text-[15px] text-(--color-text-sub) tabular-nums lg:text-right">{dateLine(state)}</p>
    </header>
  );
}
