import type { BracketRound, Fixture, FixtureSlot, TournamentView } from '@autoscore/schema';
import { useId } from 'react';
import type { RunningLegs } from '../api/use-running-legs';
import { bracketColumns, fixtureTag, type BracketColumn } from '../game/bracket';
import { formatAverage } from '../game/format-stat';
import { tournamentMatchHref } from '../game/tournament-match-href';
import { slotPlayer, slotSourceText } from '../game/tournament-slot';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface PlayoffBracketProps {
  view: TournamentView;
  live: ReadonlyMap<string, RunningLegs>;
}

const ROUND_NAMES: Readonly<Record<BracketRound, string>> = {
  r16: pl.phaseR16,
  qf: pl.phaseQf,
  sf: pl.phaseSf,
  final: pl.phaseFinal,
};

const labelClass = 'font-display text-(length:--text-label) font-bold tracking-[0.14em] text-(--color-text-muted) uppercase';

function boxLegs(fixture: Fixture, live: ReadonlyMap<string, RunningLegs>): readonly [number, number] | null {
  if (fixture.result) {
    return fixture.result.legs;
  }
  return fixture.status === 'in_progress' ? (live.get(fixture.id)?.legs ?? null) : null;
}

interface SlotRowProps {
  view: TournamentView;
  slot: FixtureSlot;
  legs: number | null;
  average: number | null;
  outcome: 'winner' | 'loser' | null;
}

function SlotRow({ view, slot, legs, average, outcome }: SlotRowProps) {
  const player = slotPlayer(view, slot);
  const winner = outcome === 'winner';
  let nameColor = 'text-(--color-text)';
  if (!player) {
    nameColor = 'text-(--color-text-muted)';
  } else if (outcome === 'loser') {
    nameColor = 'text-(--color-text-sub)';
  }
  return (
    <div className={`flex h-[54px] items-center gap-2.5 px-3 ${winner ? 'bg-(--color-surface-soft)' : ''}`}>
      <span className="w-6 shrink-0 font-display text-[17px] font-extrabold text-(--color-text-muted) tabular-nums">
        {slot.kind === 'player' ? (slot.seed ?? '') : ''}
      </span>
      {player ? (
        <Avatar name={player.name} avatar={player.avatar} color={player.color} size="small" />
      ) : (
        <span aria-hidden="true" className="size-9 shrink-0 rounded-full border-2 border-dashed border-(--color-border)" />
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={`min-w-0 truncate font-display text-[21px] ${winner ? 'font-extrabold' : 'font-semibold'} ${nameColor}`}>
          {slotSourceText(view, slot)}
        </span>
        {winner && <span className="sr-only">{pl.bracketWinner}</span>}
        {average !== null && (
          <span className="shrink-0 text-[13px] text-(--color-text-muted) tabular-nums">
            <span className="sr-only">{pl.averageSr} </span>
            {formatAverage(average)}
          </span>
        )}
      </span>
      <span
        className={`w-10 shrink-0 text-center font-display text-[26px] font-black tabular-nums ${winner ? 'border-l-3 border-(--color-accent) text-(--color-text)' : 'text-(--color-text-muted)'}`}
      >
        {legs ?? ''}
      </span>
    </div>
  );
}

interface MatchBoxProps {
  view: TournamentView;
  fixture: Fixture;
  live: ReadonlyMap<string, RunningLegs>;
}

function MatchBox({ view, fixture, live }: MatchBoxProps) {
  const legs = boxLegs(fixture, live);
  const running = fixture.status === 'in_progress';
  const outcomeOf = (slot: FixtureSlot): SlotRowProps['outcome'] => {
    if (!fixture.result || slot.kind !== 'player') {
      return null;
    }
    return slot.playerId === fixture.result.winnerId ? 'winner' : 'loser';
  };
  const { matchId } = fixture;
  const href = matchId !== null && (fixture.status === 'finished' || running) ? tournamentMatchHref(view.id, matchId) : null;
  const Box = href === null ? 'div' : 'a';
  return (
    <div className="flex flex-col gap-1.5">
      <Box
        href={href ?? undefined}
        className={`flex flex-col overflow-hidden rounded-(--radius-card) bg-(--color-surface) text-(--color-text) no-underline ${running ? 'inset-ring-2 inset-ring-(--color-accent)' : 'shadow-(--shadow-inset-line)'}`}
      >
        {href !== null && (
          <>
            <span className="sr-only">{pl.fixtureDetails(fixture.number)}</span>{' '}
          </>
        )}
        {fixture.slots.map((slot, index) => (
          <SlotRow
            key={index}
            view={view}
            slot={slot}
            legs={legs?.[index] ?? null}
            average={fixture.averages?.[index] ?? null}
            outcome={outcomeOf(slot)}
          />
        ))}
      </Box>
      <p className={`flex items-center gap-1.5 text-[13px] ${running ? 'text-(--color-text)' : 'text-(--color-text-muted)'}`}>
        {running && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--color-accent)" />}
        {fixtureTag(view, fixture, live.get(fixture.id)?.legNumber ?? null)}
      </p>
    </div>
  );
}

interface ColumnsProps {
  view: TournamentView;
  columns: readonly BracketColumn[];
  live: ReadonlyMap<string, RunningLegs>;
  labelledBy: string;
  headingLevel: 3 | 4;
}

// Kolumny mają tę samą wysokość, więc justify-around stawia każdy mecz między dwoma meczami, z których przychodzą gracze.
function BracketColumns({ view, columns, live, labelledBy, headingLevel }: ColumnsProps) {
  const baseId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  return (
    <div role="region" aria-labelledby={labelledBy} tabIndex={0} className="max-w-full overflow-x-auto rounded-(--radius-card)">
      <div className="flex w-max gap-10 pb-1">
        {columns.map((column) => {
          const headingId = `${baseId}-round-${column.round}`;
          return (
            <div key={column.round} className="flex w-[300px] shrink-0 flex-col gap-3">
              <Heading id={headingId} className={labelClass}>
                {pl.bracketColumn(ROUND_NAMES[column.bracketRound], column.legsToWin)}
              </Heading>
              <ol aria-labelledby={headingId} className="flex flex-1 flex-col justify-around gap-5">
                {column.fixtures.map((fixture) => (
                  <li key={fixture.id}>
                    <MatchBox view={view} fixture={fixture} live={live} />
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ExtraMatchProps {
  view: TournamentView;
  title: string;
  fixture: Fixture;
  live: ReadonlyMap<string, RunningLegs>;
}

function ExtraMatch({ view, title, fixture, live }: ExtraMatchProps) {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2.5">
      <h3 className={labelClass}>{title}</h3>
      <MatchBox view={view} fixture={fixture} live={live} />
    </div>
  );
}

export function PlayoffBracket({ view, live }: PlayoffBracketProps) {
  const titleId = useId();
  const consolationId = useId();
  const columns = bracketColumns(view, 'playoff');
  const third = view.fixtures.find((fixture) => fixture.phase === 'third_place');
  const consolation = bracketColumns(view, 'consolation');
  const singleConsolation = consolation.length === 1 ? consolation[0]?.fixtures[0] : undefined;
  const advance = view.config.advance ?? 0;
  // Bez nazwy na sekcji: regionem z tytułem jest tylko przewijana ramka drabinki, jak w tabeli grupy.
  return (
    <section className="sc-panel min-w-0 gap-3.5 px-3 py-4 sm:px-5">
      <h2 id={titleId} className="font-display text-[26px] leading-tight font-extrabold">
        {pl.bracket}
      </h2>
      <BracketColumns view={view} columns={columns} live={live} labelledBy={titleId} headingLevel={3} />
      {(third || consolation.length > 0) && (
        <>
          <div aria-hidden="true" className="h-px shrink-0 bg-(--color-border)" />
          {(third || singleConsolation) && (
            <div className="flex flex-wrap gap-x-10 gap-y-5">
              {third && (
                <ExtraMatch view={view} title={pl.bracketColumn(pl.phaseThirdPlace, third.legsToWin)} fixture={third} live={live} />
              )}
              {singleConsolation && (
                <ExtraMatch
                  view={view}
                  title={pl.consolationPlaces(advance + 1, advance + 2, singleConsolation.legsToWin)}
                  fixture={singleConsolation}
                  live={live}
                />
              )}
            </div>
          )}
          {consolation.length > 1 && (
            <div className="flex min-w-0 flex-col gap-3">
              <h3 id={consolationId} className="font-display text-[22px] leading-tight font-extrabold">
                {pl.phaseConsolation}
              </h3>
              <BracketColumns view={view} columns={consolation} live={live} labelledBy={consolationId} headingLevel={4} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
