import type { LegProgress } from '@autoscore/schema';
import type { ChartSize, ChartTick } from './form-chart';

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
  readonly maxDarts: number; // najdłuższa linia zaokrąglona w górę do pełnej kolejki, co najmniej jedna kolejka
  readonly lines: readonly ProgressChartLine[];
  readonly dartGrid: readonly ChartTick[];
  readonly dartLabels: readonly ChartTick[];
  readonly scoreGrid: readonly ChartTick[];
  readonly scoreLabels: readonly ChartTick[];
}

const DARTS_PER_TURN = 3;
const MAX_DART_LABELS = 12;
const MAX_SCORE_LINES = 7;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function multiples(step: number, limit: number): number[] {
  const values: number[] = [];
  for (let value = step; value < limit; value += step) {
    values.push(value);
  }
  return values;
}

export function dartLabelStep(maxDarts: number): number {
  let step = DARTS_PER_TURN;
  while (maxDarts / step > MAX_DART_LABELS) {
    step *= 2;
  }
  return step;
}

export function scoreGridStep(startingScore: number): number {
  let step = 50;
  while (Math.floor(startingScore / step) > MAX_SCORE_LINES) {
    step *= 2;
  }
  return step;
}

// Skala y jest stała, od wyniku startowego na górze do 0 na dole, bo wykres pokazuje drogę do zera, a nie rozrzut wyników.
export function scoreProgressChart(progress: LegProgress, { width, height, padding }: ChartSize): ScoreProgressLayout {
  const { startingScore } = progress;
  const longest = Math.max(0, ...progress.players.map((player) => player.points.length));
  const maxDarts = Math.max(DARTS_PER_TURN, Math.ceil(longest / DARTS_PER_TURN) * DARTS_PER_TURN);
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const xAt = (dart: number): number => round(padding + (dart * innerWidth) / maxDarts);
  const yAt = (remaining: number): number => round(height - padding - (remaining / startingScore) * innerHeight);
  const at = (dart: number, remaining: number, bust: boolean): ProgressChartPoint => ({ x: xAt(dart), y: yAt(remaining), remaining, bust });
  const dartTick = (value: number): ChartTick => ({ value, position: xAt(value) });
  const scoreTick = (value: number): ChartTick => ({ value, position: yAt(value) });
  const labelStep = dartLabelStep(maxDarts);
  const scoreStep = scoreGridStep(startingScore);
  const steps = multiples(scoreStep, startingScore);
  const dartGrid = [0, ...multiples(DARTS_PER_TURN, maxDarts + 1)].map(dartTick);
  const dartLabels = [0, ...multiples(labelStep, maxDarts + 1)].map(dartTick);
  const scoreGrid = [0, ...steps, startingScore].map(scoreTick);
  // Etykieta tuż pod wynikiem startowym nachodziłaby na niego, więc zostaje tylko jej linia.
  const labelled = steps.filter((value) => startingScore - value >= scoreStep / 2).reverse();
  const scoreLabels = [startingScore, ...labelled, 0].map(scoreTick);
  const lines = progress.players.map((player) => {
    const points = [at(0, startingScore, false), ...player.points.map((point) => at(point.dart, point.remaining, point.bust))];
    const path = points.length < 2 ? '' : points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
    return { playerId: player.playerId, points, path };
  });
  return { maxDarts, lines, dartGrid, dartLabels, scoreGrid, scoreLabels };
}
