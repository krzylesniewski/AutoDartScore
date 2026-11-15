import { hitPoints } from '@autoscore/engine';
import type { MatchSnapshot } from '@autoscore/schema';
import { useId, type ReactNode } from 'react';
import { hitLabel } from '../game/hit-label';
import { type TurnHistoryCell, type TurnHistoryModel, turnHistory } from '../game/turn-history';
import { pl } from '../i18n/pl';
import { BustIcon, PlaceIcon } from './icons';

export interface TurnHistoryProps {
  state: MatchSnapshot;
  // Przycisk w wierszu tytułu, np. zamknięcie panelu na telefonie.
  action?: ReactNode;
  // Kafelki: poniżej lg między tytułem a tabelą, od lg pod tabelą.
  children?: ReactNode;
}

const headCell = 'pb-1 font-display text-base leading-tight font-bold';
const rowHead = 'border-t border-(--color-border) py-0.5 text-left font-display text-base leading-snug font-bold text-(--color-text-muted)';
const bodyCell = 'border-t border-(--color-border) py-0.5 font-display text-lg leading-snug font-bold';
const points = 'font-body text-[13px] font-normal text-(--color-text-muted)';
const bustMark = 'inline-flex items-center gap-1 font-body text-[13px] font-semibold text-(--color-text)';
// Tabela przewija się sama. Odwrócony kierunek zaczyna przewijanie od końca, czyli od bieżącej tury, bez JavaScriptu.
const verticalScroll = 'flex min-h-0 flex-col-reverse overflow-y-auto max-lg:max-h-24 lg:flex-1';

export function TurnHistory({ state, action, children }: TurnHistoryProps) {
  const titleId = useId();
  if (state.practiceMode === 'checkouts') {
    return null;
  }
  const model = turnHistory(state);
  const { title, subtitle } = headingOf(state);
  return (
    <section aria-labelledby={titleId} className="@container flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="flex min-w-0 grow flex-col gap-0.5 lg:flex-row lg:flex-wrap lg:items-baseline lg:justify-between lg:gap-x-3.5">
          <h2 id={titleId} className="font-display text-[21px] leading-tight font-extrabold text-(--color-text)">
            {title}
          </h2>
          <span className="text-[13px] leading-tight text-(--color-text-muted)">{subtitle}</span>
        </div>
        {action}
      </div>
      {children && <div className="shrink-0 lg:order-last">{children}</div>}
      {state.practiceMode === 'solo_501' ? (
        <SoloTable model={model} titleId={titleId} />
      ) : state.practiceMode === 'free_run' ? (
        <FreeRunTable state={state} titleId={titleId} />
      ) : (
        <PlayersTable model={model} state={state} />
      )}
    </section>
  );
}

function headingOf(state: MatchSnapshot): { title: string; subtitle: string } {
  if (state.practiceMode === 'solo_501') {
    return { title: pl.legRun, subtitle: pl.legRunSubtitle };
  }
  if (state.practiceMode === 'free_run') {
    return { title: pl.sessionRun, subtitle: pl.sessionRunSubtitle };
  }
  if (state.type === 'match') {
    return { title: `${pl.turnHistory} · ${pl.legNumber(state.legIndex + 1)}`, subtitle: pl.turnHistorySubtitle };
  }
  return { title: pl.turnHistory, subtitle: pl.turnHistorySubtitle };
}

function ThrowingNow() {
  return (
    <>
      <span aria-hidden="true">…</span>
      <span className="sr-only">{pl.throwingNowShort}</span>
    </>
  );
}

// Nagłówki kolumn stoją w osobnej tabeli nad przewijaną częścią, żeby nie znikały przy przewijaniu.
// Czytnik ekranu dostaje je z niewidocznego thead właściwej tabeli, więc kopia jest ukryta.
function VerticalTable({ colgroup, head, caption, labelledBy, children }: { colgroup: ReactNode; head: (scoped: boolean) => ReactNode; caption?: string; labelledBy?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-col lg:flex-1">
      <table aria-hidden="true" className="w-full shrink-0 table-fixed border-collapse">
        {colgroup}
        <thead>
          <tr>{head(false)}</tr>
        </thead>
      </table>
      <div className={verticalScroll}>
        {/* mb-auto trzyma krótką tabelę pod nagłówkami, bo w odwróconej kolumnie wolne miejsce byłoby nad nią. */}
        <table aria-labelledby={labelledBy} className="mb-auto w-full table-fixed border-collapse tabular-nums">
          {caption && <caption className="sr-only">{caption}</caption>}
          {colgroup}
          <thead className="sr-only">
            <tr>{head(true)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function PlayersTable({ model, state }: { model: TurnHistoryModel; state: MatchSnapshot }) {
  // Przy 4 graczach w wąskiej kolumnie punkty i bust schodzą pod wynik.
  const stack = model.columns.length >= 4 ? STACKED : INLINE;
  const tone = (playerId: string) => (playerId === state.currentPlayerId ? 'text-(--color-text)' : 'text-(--color-text-sub)');
  const colgroup = (
    <colgroup>
      <col className="w-10" />
      {model.columns.map((player) => (
        <col key={player.id} />
      ))}
    </colgroup>
  );
  return (
    <VerticalTable
      colgroup={colgroup}
      caption={pl.turnHistoryCaption}
      head={(scoped) => (
        <>
          <th scope={scoped ? 'col' : undefined} className={`${headCell} text-left text-(--color-text-muted)`}>
            {pl.turnColumn}
          </th>
          {model.columns.map((player) => (
            <th key={player.id} scope={scoped ? 'col' : undefined} className={`${headCell} truncate text-right ${tone(player.id)}`}>
              {player.name}
            </th>
          ))}
        </>
      )}
    >
      {model.rows.map((cells, row) => {
        const current = row === model.currentRow;
        return (
          <tr key={row} aria-current={current ? 'true' : undefined} className={current ? 'bg-(--color-surface-softer)' : undefined}>
            <th scope="row" className={rowHead}>
              {row + 1}
            </th>
            {cells.map((cell, column) => {
              const player = model.columns[column];
              return (
                <td key={player?.id ?? column} className={`${bodyCell} text-right ${tone(player?.id ?? '')}`}>
                  <PlayerCell cell={cell} stack={stack} />
                </td>
              );
            })}
          </tr>
        );
      })}
    </VerticalTable>
  );
}

interface Stack {
  points: string;
  bust: string;
}

const INLINE: Stack = { points: '', bust: '' };
const STACKED: Stack = { points: '@max-md:block', bust: '@max-md:flex @max-md:justify-end' };

function PlayerCell({ cell, stack }: { cell: TurnHistoryCell; stack: Stack }) {
  switch (cell.kind) {
    case 'current':
      return <ThrowingNow />;
    case 'out':
      return (
        <span className={points}>
          <span aria-hidden="true">–</span>
          <span className="sr-only">{pl.outOfQueue}</span>
        </span>
      );
    case 'empty':
      return null;
    case 'turn':
      if (cell.bust) {
        return (
          <>
            {cell.remainingAfter}{' '}
            <span className={`${bustMark} ${stack.bust}`}>
              <BustIcon />
              {pl.bust}
            </span>
          </>
        );
      }
      return (
        <>
          {cell.place !== null && <Place place={cell.place} />}
          {cell.remainingAfter} <small className={`${points} ${stack.points}`}>({cell.points})</small>
        </>
      );
  }
}

function Place({ place }: { place: number }) {
  return (
    <>
      <span aria-hidden="true" className={`${bustMark} mr-1`}>
        <PlaceIcon className={place === 1 ? 'text-(--color-gold)' : 'text-(--color-text)'} />
        {pl.placeNumber(place)}
      </span>
      <span className="sr-only">{pl.place(place)} </span>
    </>
  );
}

function FreeRunTable({ state, titleId }: { state: MatchSnapshot; titleId: string }) {
  const inProgress = state.status === 'in_progress';
  const partial = state.currentDarts.reduce((sum, dart) => sum + hitPoints(dart), 0);
  const colgroup = (
    <colgroup>
      <col className="w-12" />
      <col />
      <col className="w-16" />
    </colgroup>
  );
  return (
    <VerticalTable
      colgroup={colgroup}
      labelledBy={titleId}
      head={(scoped) => (
        <>
          <th scope={scoped ? 'col' : undefined} className={`${headCell} text-left text-(--color-text-muted)`}>
            {pl.turnColumn}
          </th>
          <th scope={scoped ? 'col' : undefined} className={`${headCell} text-left text-(--color-text-muted)`}>
            {pl.dartsThrown}
          </th>
          <th scope={scoped ? 'col' : undefined} className={`${headCell} text-right text-(--color-text-muted)`}>
            {pl.rowPoints}
          </th>
        </>
      )}
    >
      {state.legTurns.map((turn, index) => (
        <tr key={index}>
          <th scope="row" className={rowHead}>
            {index + 1}
          </th>
          <td className={`${bodyCell} truncate text-left text-(--color-text-sub)`}>{turn.darts.map(hitLabel).join(' · ')}</td>
          <td className={`${bodyCell} text-right text-(--color-text)`}>{turn.points}</td>
        </tr>
      ))}
      {inProgress && (
        <tr aria-current="true" className="bg-(--color-surface-softer)">
          <th scope="row" className={rowHead}>
            {state.legTurns.length + 1}
          </th>
          <td className={`${bodyCell} truncate text-left text-(--color-text)`}>
            {state.currentDarts.map((dart) => `${hitLabel(dart)} · `).join('')}
            <ThrowingNow />
          </td>
          <td className={`${bodyCell} text-right text-(--color-text)`}>{state.currentDarts.length > 0 ? partial : null}</td>
        </tr>
      )}
    </VerticalTable>
  );
}

const soloCell = 'min-w-11 border-t border-(--color-border) px-1.5 py-1.5 text-center font-display font-bold';
const soloRowHead = 'border-t border-(--color-border) py-1.5 pr-3 text-left font-display text-base font-bold text-(--color-text-muted)';

// Tabela pozioma: tury w kolumnach. Odwrócony wiersz zaczyna przewijanie od prawej, czyli od bieżącej tury.
function SoloTable({ model, titleId }: { model: TurnHistoryModel; titleId: string }) {
  const cells = model.rows.map((row) => row[0] ?? { kind: 'empty' as const });
  const currentBg = (index: number) => (index === model.currentRow ? 'bg-(--color-surface-soft)' : '');
  return (
    <div className="flex shrink-0 flex-row-reverse items-start overflow-x-auto">
      <table aria-labelledby={titleId} className="w-max min-w-full border-collapse tabular-nums">
        <thead>
          <tr>
            <th scope="col" className="pr-3 pb-1 text-left font-display text-base font-bold text-(--color-text-muted)">
              {pl.turnColumn}
            </th>
            {cells.map((_, index) => (
              <th
                key={index}
                scope="col"
                aria-current={index === model.currentRow ? 'true' : undefined}
                className={`min-w-11 rounded-t-lg px-1.5 pb-1 text-center font-display text-base font-bold ${index === model.currentRow ? 'text-(--color-text)' : 'text-(--color-text-muted)'} ${currentBg(index)}`}
              >
                {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={soloRowHead}>
              {pl.rowPoints}
            </th>
            {cells.map((cell, index) => (
              <td key={index} className={`${soloCell} text-xl text-(--color-text) ${currentBg(index)}`}>
                {cell.kind === 'current' && <ThrowingNow />}
                {cell.kind === 'turn' &&
                  (cell.bust ? (
                    <span className={bustMark}>
                      <BustIcon />
                      {pl.bust}
                    </span>
                  ) : (
                    cell.points
                  ))}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={soloRowHead}>
              {pl.rowRemaining}
            </th>
            {cells.map((cell, index) => (
              <td key={index} className={`${soloCell} text-lg text-(--color-text-sub) ${currentBg(index)}`}>
                {cell.kind === 'turn' ? cell.remainingAfter : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
