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

export interface FormChartLayout {
  readonly points: readonly ChartPoint[];
  readonly min: number | null;
  readonly max: number | null;
  readonly path: string; // linia SVG, pusta poniżej 2 punktów
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// Współrzędne SVG: y rośnie w dół, więc najwyższa średnia ma najmniejsze y. Równe wartości leżą na środku wysokości.
export function formChart(values: readonly number[], { width, height, padding }: ChartSize): FormChartLayout {
  if (values.length === 0) {
    return { points: [], min: null, max: null, path: '' };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;
  const points = values.map((value, index) => ({
    x: round(values.length === 1 ? width / 2 : padding + (index * innerWidth) / (values.length - 1)),
    y: round(max === min ? height / 2 : height - padding - ((value - min) / (max - min)) * innerHeight),
    value,
  }));
  const path = points.length < 2 ? '' : points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ');
  return { points, min, max, path };
}
