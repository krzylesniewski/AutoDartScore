import type { MatchLeg, MatchLegs } from '@autoscore/schema';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { legRows, legStory, type LegRow, type LegRowSide } from '../game/leg-rows';
import { pl } from '../i18n/pl';
import { Notice } from './Notice';

export interface LegHistoryProps {
  legs: MatchLegs | null; // null do pierwszej odpowiedzi
  error: boolean;
  names: ReadonlyMap<string, string>;
}

const headClass = 'px-2 pb-1 font-display text-[15px] font-bold tracking-[0.1em] text-(--color-text-muted) uppercase';
const cellClass = 'px-2 py-1.5 font-display text-xl tabular-nums';

function PointsCell({ side }: { side: LegRowSide | null }) {
  if (!side) {
    return <td className={cellClass} />;
  }
  if (side.bust) {
    return <td className={`${cellClass} font-semibold text-(--color-text-muted)`}>{pl.bust}</td>;
  }
  if (side.checkout !== null) {
    return (
      <td className={`${cellClass} font-black whitespace-nowrap text-(--color-gold)`}>
        <span className="sr-only">{pl.checkoutSr} </span>
        {`${side.points} · ${side.checkout}`}
      </td>
    );
  }
  return <td className={`${cellClass} ${side.points >= 100 ? 'font-black' : 'font-semibold'}`}>{side.points}</td>;
}

function LeftCell({ side }: { side: LegRowSide | null }) {
  return <td className={`${cellClass} font-semibold text-(--color-text-sub)`}>{side?.remainingAfter ?? ''}</td>;
}

function TurnsTable({ rows, names, labelledBy }: { rows: readonly LegRow[]; names: readonly [string, string]; labelledBy: string }) {
  return (
    <div role="region" aria-labelledby={labelledBy} tabIndex={0} className="max-w-full overflow-x-auto rounded-(--radius-card)">
      <table aria-labelledby={labelledBy} className="w-full border-collapse text-center">
        <thead>
          <tr>
            <th scope="col" className={headClass}>
              {pl.columnScored}
            </th>
            <th scope="col" className={headClass}>
              {pl.columnLeft}
            </th>
            <th scope="col" className={headClass}>
              {pl.columnDarts}
            </th>
            <th scope="col" className={headClass}>
              {pl.columnScored}
            </th>
            <th scope="col" className={headClass}>
              {pl.columnLeft}
            </th>
          </tr>
          <tr>
            <th scope="colgroup" colSpan={2} className="max-w-0 truncate px-2 pb-2 font-display text-lg font-bold">
              {names[0]}
            </th>
            <td />
            <th scope="colgroup" colSpan={2} className="max-w-0 truncate px-2 pb-2 font-display text-lg font-bold">
              {names[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.round} className="border-t border-(--color-border-subtle)">
              <PointsCell side={row.sides[0]} />
              <LeftCell side={row.sides[0]} />
              <td className={`${cellClass} bg-(--color-surface-softer) text-base text-(--color-text-muted)`}>{row.darts}</td>
              <PointsCell side={row.sides[1]} />
              <LeftCell side={row.sides[1]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function tabText(leg: MatchLeg, names: ReadonlyMap<string, string>): string {
  return leg.winnerId === null ? pl.fixtureLive : (names.get(leg.winnerId) ?? '');
}

export function LegHistory({ legs, error, names }: LegHistoryProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="sc-panel min-w-0 gap-4 px-3 py-4 sm:px-5.5">
      <h2 id={titleId} className="font-display text-[26px] leading-tight font-extrabold">
        {pl.legHistory}
      </h2>
      {error && <Notice text={pl.loadLegsFailed} appearance="soft" />}
      {!legs && !error && <p className="text-(--color-text-muted)">{pl.loading}</p>}
      {legs && <LegTabs legs={legs} names={names} />}
    </section>
  );
}

// Bez wyboru zaznaczony jest ostatni leg, więc zaznaczenie idzie za nowym legiem na żywo. Wybrany leg zostaje po aktualizacjach.
function LegTabs({ legs, names }: { legs: MatchLegs; names: ReadonlyMap<string, string> }) {
  const baseId = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const last = legs.legs.at(-1);
  const selected = legs.legs.find((leg) => leg.legIndex === picked) ?? last;
  const playerIds: [string, string] = [legs.players[0] ?? '', legs.players[1] ?? ''];
  const tabId = (legIndex: number) => `${baseId}-tab-${legIndex}`;
  const panelId = `${baseId}-panel`;

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = legs.legs[(index + step + legs.legs.length) % legs.legs.length];
    if (next) {
      setPicked(next.legIndex);
      buttons.current.get(next.legIndex)?.focus();
    }
  }

  return (
    <>
      <div role="tablist" aria-label={pl.legTabs} className="flex flex-wrap gap-2">
        {legs.legs.map((leg, index) => {
          const isSelected = leg === selected;
          return (
            <button
              key={leg.legIndex}
              ref={(element) => {
                if (element) {
                  buttons.current.set(leg.legIndex, element);
                } else {
                  buttons.current.delete(leg.legIndex);
                }
              }}
              type="button"
              role="tab"
              id={tabId(leg.legIndex)}
              aria-selected={isSelected}
              aria-controls={isSelected ? panelId : undefined}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setPicked(leg.legIndex)}
              onKeyDown={(event) => move(event, index)}
              className={`flex min-h-11 min-w-20 flex-col items-center justify-center rounded-(--radius-chip) px-3 py-1.5 leading-tight ${isSelected ? 'bg-(--color-surface-soft) text-(--color-text) inset-ring-2 inset-ring-(--color-accent)' : 'text-(--color-text-sub) shadow-(--shadow-inset-line)'}`}
            >
              <span className="font-display text-lg font-bold">{pl.legNumber(leg.legIndex + 1)}</span>{' '}
              <span className="max-w-28 truncate text-[13px]">{tabText(leg, names)}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected.legIndex)} className="flex min-w-0 flex-col gap-3">
          <p className="text-[17px] text-(--color-text-sub)">{legStory(selected, names)}</p>
          <LegTurns leg={selected} playerIds={playerIds} names={names} labelledBy={tabId(selected.legIndex)} />
        </div>
      )}
    </>
  );
}

function LegTurns({
  leg,
  playerIds,
  names,
  labelledBy,
}: {
  leg: MatchLeg;
  playerIds: [string, string];
  names: ReadonlyMap<string, string>;
  labelledBy: string;
}) {
  const rows = legRows(leg, playerIds);
  if (rows.length === 0) {
    return <p className="text-(--color-text-muted)">{pl.noClosedTurns}</p>;
  }
  return <TurnsTable rows={rows} names={[names.get(playerIds[0]) ?? '', names.get(playerIds[1]) ?? '']} labelledBy={labelledBy} />;
}
