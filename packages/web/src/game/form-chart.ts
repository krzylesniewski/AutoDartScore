export interface ChartSize {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
  readonly value: number;
}

export interface ChartTick {
  readonly value: number; // lotki, punkty, średnia albo numer gry
  readonly position: number; // x SVG na osi poziomej, y SVG na osi pionowej, zaokrąglone jak punkty
}

export interface FormChartLayout {
  readonly points: readonly ChartPoint[];
  readonly min: number | null;
  readonly max: number | null;
  readonly low: number | null; // dolna linia siatki, dół wykresu
  readonly high: number | null; // górna linia siatki, góra wykresu
  readonly grid: readonly ChartTick[];
  readonly gameLabels: readonly ChartTick[];
  readonly path: string; // linia SVG, pusta poniżej 2 punktów
}

const GRID_STEPS = [1, 2, 5, 10, 20, 50] as const;
const MAX_GRID_LINES = 5;
const MIN_GRID_LINES = 3;
const GAME_LABEL_STEPS = [1, 2, 5, 10] as const;
const MAX_GAME_LABELS = 10;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function lineCount(low: number, high: number, step: number): number {
  return (high - low) / step + 1;
}

function gridRange(min: number, max: number): { low: number; high: number; step: number } {
  const step = GRID_STEPS.find((candidate) => lineCount(Math.floor(min / candidate) * candidate, Math.ceil(max / candidate) * candidate, candidate) <= MAX_GRID_LINES) ?? 50;
  let low = Math.floor(min / step) * step;
  let high = Math.ceil(max / step) * step;
  while (lineCount(low, high, step) < MIN_GRID_LINES) {
    low = Math.max(0, low - step);
    high += step;
  }
  return { low, high, step };
}

function gameLabelStep(count: number): number {
  return GAME_LABEL_STEPS.find((step) => Math.ceil(count / step) <= MAX_GAME_LABELS) ?? 10;
}

// Współrzędne SVG: y rośnie w dół, więc najwyższa średnia ma najmniejsze y. Skala biegnie od dolnej do górnej linii siatki.
// Przy za małej liczbie linii siatka poszerza się o krok w obie strony naraz. Równe wartości leżą wtedy na środkowej linii albo między dwiema środkowymi, chyba że dolna linia oprze się o 0.
export function formChart(values: readonly number[], { width, height, padding }: ChartSize): FormChartLayout {
  if (values.length === 0) {
    return { points: [], min: null, max: null, low: null, high: null, grid: [], gameLabels: [], path: '' };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const { low, high, step } = gridRange(min, max);
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const xAt = (index: number): number => round(values.length === 1 ? width / 2 : padding + (index * innerWidth) / (values.length - 1));
  const yAt = (value: number): number => round(height - padding - ((value - low) / (high - low)) * innerHeight);
  const points = values.map((value, index) => ({ x: xAt(index), y: yAt(value), value }));
  const grid: ChartTick[] = [];
  for (let value = low; value <= high; value += step) {
    grid.push({ value, position: yAt(value) });
  }
  const labelStep = gameLabelStep(values.length);
  const gameLabels = values.flatMap((_, index) => (index % labelStep === 0 ? [{ value: index + 1, position: xAt(index) }] : []));
  const path = points.length < 2 ? '' : points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  return { points, min, max, low, high, grid, gameLabels, path };
}
