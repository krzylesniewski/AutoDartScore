import type { LegProgress, MatchSnapshotPlayer } from '@autoscore/schema';
import { avatarStrokeClass } from '../game/avatar-color';
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

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
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
    <section className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) p-4">
      <h2 className={label}>{pl.scoreProgressHeading(legNumber)}</h2>
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <div aria-hidden="true" className="flex flex-col justify-between py-1 text-right font-display text-base text-(--color-text-muted) tabular-nums">
          <span>{progress.startingScore}</span>
          <span className="text-xs uppercase">{pl.scoreProgressRemaining}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0">
          <svg
            role="img"
            aria-label={description}
            viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
            preserveAspectRatio="none"
            className="block h-44 w-full rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-bg) lg:h-60"
          >
            <line x1={0} x2={SIZE.width} y1={SIZE.padding} y2={SIZE.padding} className="stroke-(--color-border)" strokeDasharray="4 4" />
            <line x1={0} x2={SIZE.width} y1={SIZE.height - SIZE.padding} y2={SIZE.height - SIZE.padding} className="stroke-(--color-border)" strokeDasharray="4 4" />
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
                  className={`absolute flex -translate-y-full items-center gap-1 rounded-(--radius-card) bg-(--color-surface) px-1 pb-0.5 font-display text-sm font-semibold uppercase text-(--color-text) ${bustAlign(point.x)}`}
                  style={{ left: percent(point.x, SIZE.width), top: percent(point.y, SIZE.height) }}
                >
                  <BustIcon className="text-(--color-accent)" />
                  {pl.bust}
                </span>
              )),
          )}
        </div>
        <div aria-hidden="true" className="col-start-2 flex justify-between font-display text-base text-(--color-text-muted) tabular-nums">
          <span>0</span>
          <span className="text-xs uppercase">{pl.scoreProgressDarts}</span>
          <span>{chart.maxDarts}</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-wrap gap-x-5 gap-y-2">
        {entries.map(({ line, player, dash }) => (
          <li key={line.playerId} className="flex min-w-0 items-center gap-2">
            <svg aria-hidden="true" viewBox="0 0 32 8" className="h-2 w-8 shrink-0">
              <line x1={0} x2={32} y1={4} y2={4} className={avatarStrokeClass(player?.color ?? 1)} strokeWidth={3} strokeDasharray={dash} />
            </svg>
            <Avatar name={player?.name ?? ''} avatar={player?.avatar ?? null} color={player?.color ?? 1} size="small" />
            <span className="min-w-0 text-lg font-semibold break-words">{player?.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
