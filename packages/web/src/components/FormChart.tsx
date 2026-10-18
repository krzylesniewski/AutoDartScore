import type { PlayerFormPoint } from '@autoscore/schema';
import { formChart } from '../game/form-chart';
import { formatAverage } from '../game/format-stat';
import { pl } from '../i18n/pl';

export interface FormChartProps {
  points: readonly PlayerFormPoint[];
}

const SIZE = { width: 600, height: 180, padding: 14 };

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
    <div className="flex gap-3">
      <div aria-hidden="true" className="flex flex-col justify-between py-1 text-right font-display text-base text-(--color-text-muted) tabular-nums">
        <span>{formatAverage(chart.max)}</span>
        <span>{formatAverage(chart.min)}</span>
      </div>
      <svg
        role="img"
        aria-label={pl.formChart(points.length, formatAverage(last))}
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
        preserveAspectRatio="none"
        className="h-44 min-w-0 flex-1 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-bg)"
      >
        <line x1={0} x2={SIZE.width} y1={SIZE.padding} y2={SIZE.padding} className="stroke-(--color-border)" strokeDasharray="4 4" />
        <line x1={0} x2={SIZE.width} y1={SIZE.height - SIZE.padding} y2={SIZE.height - SIZE.padding} className="stroke-(--color-border)" strokeDasharray="4 4" />
        {chart.path && <path d={chart.path} className="fill-none stroke-(--color-accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" />}
        {chart.points.map((point, index) => (
          <circle key={points[index]?.matchId ?? index} cx={point.x} cy={point.y} r={5} className="fill-(--color-accent)" />
        ))}
      </svg>
      <ol className="sr-only">
        {points.map((point, index) => (
          <li key={point.matchId}>{pl.formPoint(index + 1, formatAverage(point.average))}</li>
        ))}
      </ol>
    </div>
  );
}
