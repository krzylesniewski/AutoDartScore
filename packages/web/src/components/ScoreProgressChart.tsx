import type { LegProgress, MatchSnapshotPlayer } from '@autoscore/schema';
import { avatarStrokeClass } from '../game/avatar-color';
import type { ChartTick } from '../game/form-chart';
import { scoreProgressChart } from '../game/score-progress-chart';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';
import { BustIcon } from './icons';

export interface ScoreProgressChartProps {
  progress: LegProgress;
  players: readonly MatchSnapshotPlayer[];
}

const SIZE = { width: 600, height: 240, padding: 14 };

// Dwóch graczy może mieć ten sam kolor avatara, więc linie różnią się też wzorem.
const DASHES = ['none', '12 6', '4 4', '12 4 2 4'] as const;

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

// Liczby osi są w HTML, bo tekst w SVG z preserveAspectRatio="none" rozciągnąłby się razem z wykresem.
const axisNumber = 'font-display text-[15px] leading-none font-semibold text-(--color-text-muted) tabular-nums';
const axisTitle = 'font-display text-xs leading-none font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

// Liczba osi x jest wyśrodkowana pod linią, a przy krawędzi zatrzymuje się w szerokości wykresu, żeby nie wyszła poza kartę.
// Wyrównanie do krawędzi jak przy buście skleiłoby ostatnie dwie liczby na wąskim ekranie, np. 33 i 36.
function axisLeft(tick: ChartTick): string {
  const half = `${String(tick.value).length / 2}ch`;
  return `clamp(${half}, ${percent(tick.position, SIZE.width)}, calc(100% - ${half}))`;
}

// Liczba osi y jest wyśrodkowana na linii, ale przy górnej i dolnej krawędzi zatrzymuje się w wysokości wykresu.
function axisTop(position: number): string {
  return `clamp(0.5em, ${percent(position, SIZE.height)}, calc(100% - 0.5em))`;
}

// Przy krawędzi znacznik bustu nie może wyjść poza wykres, bo przewinąłby stronę w poziomie.
function bustAlign(x: number): string {
  if (x < SIZE.width * 0.2) {
    return '';
  }
  return x > SIZE.width * 0.8 ? '-translate-x-full' : '-translate-x-1/2';
}

export function ScoreProgressChart({ progress, players }: ScoreProgressChartProps) {
  const chart = scoreProgressChart(progress, SIZE);
  const legNumber = progress.legIndex + 1;
  const entries = progress.players.map((line, index) => ({
    line,
    player: players.find((player) => player.id === line.playerId),
    layout: chart.lines[index],
    dash: DASHES[index % DASHES.length] ?? 'none',
  }));
  const description = pl.scoreProgressChart(
    legNumber,
    entries.map(({ line, player }) => {
      const last = line.points.at(-1);
      return pl.scoreProgressLine(player?.name ?? '', last?.dart ?? 0, last?.remaining ?? progress.startingScore);
    }),
  );

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-(--radius-panel) bg-(--color-surface-softer) px-4 py-3.5 shadow-(--shadow-inset-line) sm:px-5.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
        <h2 className="font-display text-[22px] leading-tight font-extrabold text-(--color-text)">{pl.scoreProgressHeading(legNumber)}</h2>
        <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-2 lg:ml-auto">
          {entries.map(({ line, player, dash }) => (
            <li key={line.playerId} className="flex min-w-0 items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 32 8" className="h-2 w-7.5 shrink-0">
                <line x1={0} x2={32} y1={4} y2={4} className={avatarStrokeClass(player?.color ?? 1)} strokeWidth={3} strokeDasharray={dash} />
              </svg>
              <Avatar name={player?.name ?? ''} avatar={player?.avatar ?? null} color={player?.color ?? 1} size="small" />
              <span className="min-w-0 font-display text-lg font-bold break-words">{player?.name}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
        <span aria-hidden="true" className={`col-span-2 ${axisTitle}`}>
          {pl.scoreProgressRemaining}
        </span>
        <div aria-hidden="true" className="relative">
          <span className={`invisible block ${axisNumber}`}>{progress.startingScore}</span>
          {chart.scoreLabels.map((tick) => (
            <span key={tick.value} className={`absolute right-0 -translate-y-1/2 ${axisNumber}`} style={{ top: axisTop(tick.position) }}>
              {tick.value}
            </span>
          ))}
        </div>
        <div className="relative min-w-0">
          <svg
            role="img"
            aria-label={description}
            viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
            preserveAspectRatio="none"
            className="block h-44 w-full rounded-(--radius-chip) bg-(--color-bg)/55 lg:h-60"
          >
            {chart.dartGrid.map((tick) => (
              <line key={`x${tick.value}`} x1={tick.position} x2={tick.position} y1={0} y2={SIZE.height} className="stroke-(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {chart.scoreGrid.map((tick) => (
              <line key={`y${tick.value}`} x1={0} x2={SIZE.width} y1={tick.position} y2={tick.position} className="stroke-(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {entries.map(({ line, player, layout, dash }) => {
              const stroke = avatarStrokeClass(player?.color ?? 1);
              return (
                <g key={line.playerId}>
                  {layout?.path && <path d={layout.path} className={`fill-none ${stroke}`} strokeWidth={3} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />}
                  {/* Punkt to ścieżka zerowej długości z okrągłym końcem, bo okrąg rozciągnąłby się przy preserveAspectRatio="none". */}
                  {layout?.points.map((point, index) => (
                    <path
                      key={index}
                      d={`M${point.x} ${point.y}h0`}
                      className={stroke}
                      strokeWidth={8}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
          {chart.lines.flatMap((layout) =>
            layout.points
              .map((point, index) => ({ point, index }))
              .filter(({ point }) => point.bust)
              .map(({ point, index }) => (
                <span
                  key={`${layout.playerId}-${index}`}
                  className={`absolute flex -translate-y-full items-center gap-1 rounded-(--radius-chip) border border-(--color-accent) bg-(--color-surface) px-1.5 font-display text-[15px] font-bold uppercase text-(--color-text) ${bustAlign(point.x)}`}
                  style={{ left: percent(point.x, SIZE.width), top: percent(point.y, SIZE.height) }}
                >
                  <BustIcon className="text-(--color-accent)" />
                  {pl.bust}
                </span>
              )),
          )}
        </div>
        <div aria-hidden="true" className="relative col-start-2">
          <span className={`invisible block ${axisNumber}`}>0</span>
          {chart.dartLabels.map((tick) => (
            <span key={tick.value} className={`absolute top-0 -translate-x-1/2 ${axisNumber}`} style={{ left: axisLeft(tick) }}>
              {tick.value}
            </span>
          ))}
        </div>
        <span aria-hidden="true" className={`col-start-2 text-center ${axisTitle}`}>
          {pl.scoreProgressDarts}
        </span>
      </div>
    </section>
  );
}
