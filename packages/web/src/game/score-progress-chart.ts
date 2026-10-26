import type { LegProgress } from '@autoscore/schema';
import type { ChartSize } from './form-chart';

export interface ProgressChartPoint {
  readonly x: number;
  readonly y: number;
  readonly remaining: number;
  readonly bust: boolean;
}

export interface ProgressChartLine {
  readonly playerId: string;
  readonly points: readonly ProgressChartPoint[]; // od punktu startowego (0, startingScore)
  readonly path: string; // linia SVG, pusta bez rzutek
}

export interface ScoreProgressLayout {
  readonly maxDarts: number;
  readonly lines: readonly ProgressChartLine[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// Skala y jest stała, od wyniku startowego na górze do 0 na dole, bo wykres pokazuje drogę do zera, a nie rozrzut wyników.
export function scoreProgressChart(progress: LegProgress, { width, height, padding }: ChartSize): ScoreProgressLayout {
  const maxDarts = Math.max(1, ...progress.players.map((player) => player.points.length));
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const at = (dart: number, remaining: number, bust: boolean): ProgressChartPoint => ({
    x: round(padding + (dart * innerWidth) / maxDarts),
    y: round(height - padding - (remaining / progress.startingScore) * innerHeight),
    remaining,
    bust,
  });
  const lines = progress.players.map((player) => {
    const points = [at(0, progress.startingScore, false), ...player.points.map((point) => at(point.dart, point.remaining, point.bust))];
    const path = points.length < 2 ? '' : points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
    return { playerId: player.playerId, points, path };
  });
  return { maxDarts, lines };
}
