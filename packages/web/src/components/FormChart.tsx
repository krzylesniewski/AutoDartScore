import type { PlayerFormPoint } from '@autoscore/schema';
import { formChart, type ChartTick } from '../game/form-chart';
import { formatAverage } from '../game/format-stat';
import { pl } from '../i18n/pl';

export interface FormChartProps {
  points: readonly PlayerFormPoint[];
}

const SIZE = { width: 600, height: 180, padding: 14 };

// Liczby osi są w HTML, bo tekst w SVG z preserveAspectRatio="none" rozciągnąłby się razem z wykresem.
const axisNumber = 'font-display text-sm leading-none font-semibold text-(--color-text-muted) tabular-nums sm:text-base';

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

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

// Wartości dla czytników ekranu są w liście obok, a wykres ma tylko krótki opis.
export function FormChart({ points }: FormChartProps) {
  if (points.length === 0) {
    return <p className="font-display text-2xl text-(--color-text-muted)">{pl.formEmpty}</p>;
  }
  const chart = formChart(
    points.map((point) => point.average),
    SIZE,
  );
  const last = points.at(-1)?.average ?? null;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
      <div aria-hidden="true" className="relative">
        <span className={`invisible block ${axisNumber}`}>{formatAverage(chart.high)}</span>
        {chart.grid.map((tick) => (
          <span key={tick.value} className={`absolute right-0 -translate-y-1/2 ${axisNumber}`} style={{ top: axisTop(tick.position) }}>
            {formatAverage(tick.value)}
          </span>
        ))}
      </div>
      <svg
        role="img"
        aria-label={pl.formChart(points.length, formatAverage(last))}
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        preserveAspectRatio="none"
        className="block h-44 w-full min-w-0 rounded-[10px] bg-(--color-bg)/55"
      >
        {chart.grid.map((tick) => (
          <line key={tick.value} x1={0} x2={SIZE.width} y1={tick.position} y2={tick.position} className="stroke-(--color-border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {chart.path && <path d={chart.path} className="fill-none stroke-(--color-accent)" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
        {chart.points.map((point, index) => (
          <circle
            key={points[index]?.matchId ?? index}
            cx={point.x}
            cy={point.y}
            r={5}
            className="fill-(--color-accent) stroke-(--color-surface)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div aria-hidden="true" className="relative col-start-2">
        <span className={`invisible block ${axisNumber}`}>1</span>
        {chart.gameLabels.map((tick) => (
          <span key={tick.value} className={`absolute top-0 -translate-x-1/2 ${axisNumber}`} style={{ left: axisLeft(tick) }}>
            {tick.value}
          </span>
        ))}
      </div>
      <ol className="sr-only">
        {points.map((point, index) => (
          <li key={point.matchId}>{pl.formPoint(index + 1, formatAverage(point.average))}</li>
        ))}
      </ol>
    </div>
  );
}
