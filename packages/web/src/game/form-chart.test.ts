import { describe, expect, it } from 'vitest';
import { formChart } from './form-chart';

const size = { width: 120, height: 60, padding: 10 };

describe('formChart', () => {
  it('has no points, bounds or line without values', () => {
    expect(formChart([], size)).toEqual({ points: [], min: null, max: null, low: null, high: null, grid: [], gameLabels: [], path: '' });
  });

  it('puts a single value in the middle, without a line', () => {
    expect(formChart([45.5], size)).toEqual({
      points: [{ x: 60, y: 30, value: 45.5 }],
      min: 45.5,
      max: 45.5,
      low: 44,
      high: 47,
      grid: [
        { value: 44, position: 50 },
        { value: 45, position: 36.67 },
        { value: 46, position: 23.33 },
        { value: 47, position: 10 },
      ],
      gameLabels: [{ value: 1, position: 60 }],
      path: '',
    });
  });

  it('spreads the values over the width and maps the highest to the top', () => {
    const chart = formChart([40, 80, 60], size);
    expect(chart.min).toBe(40);
    expect(chart.max).toBe(80);
    expect(chart.points).toEqual([
      { x: 10, y: 50, value: 40 },
      { x: 60, y: 10, value: 80 },
      { x: 110, y: 30, value: 60 },
    ]);
    expect(chart.path).toBe('M10 50 L60 10 L110 30');
  });

  it('draws equal values as a flat line in the middle', () => {
    expect(formChart([50, 50], size).points.map((point) => point.y)).toEqual([30, 30]);
  });

  it('rounds the coordinates to 2 decimals', () => {
    const chart = formChart([0, 1, 2, 3], size);
    expect(chart.points.map((point) => point.x)).toEqual([10, 43.33, 76.67, 110]);
    expect(chart.points.map((point) => point.y)).toEqual([50, 36.67, 23.33, 10]);
  });
});

describe('formChart: grid', () => {
  it.each([
    [[40, 80, 60], [40, 50, 60, 70, 80]],
    [[60.25, 60.5], [59, 60, 61, 62]],
    [[20, 95], [20, 40, 60, 80, 100]],
    [[50, 50], [49, 50, 51]],
    [[45.5], [44, 45, 46, 47]],
    [[0, 0], [0, 1, 2]],
  ])('draws round grid lines for %j', (values, lines) => {
    const chart = formChart(values, size);
    expect(chart.grid.map((tick) => tick.value)).toEqual(lines);
    expect(chart.grid.length).toBeGreaterThanOrEqual(3);
    expect(chart.grid.length).toBeLessThanOrEqual(5);
    expect(chart.low).toBe(lines[0]);
    expect(chart.high).toBe(lines.at(-1));
  });

  it('puts the lowest grid line at the bottom and the highest at the top', () => {
    const chart = formChart([20, 95], size);
    expect(chart.grid[0]?.position).toBe(50);
    expect(chart.grid.at(-1)?.position).toBe(10);
    expect(chart.grid.map((tick) => tick.position)).toEqual([50, 40, 30, 20, 10]);
  });

  it('never goes below 0', () => {
    expect(formChart([0, 0], size).points.map((point) => point.y)).toEqual([50, 50]);
    expect(formChart([0.5], size).grid.map((tick) => tick.value)).toEqual([0, 1, 2]);
  });
});

describe('formChart: game labels', () => {
  function labels(count: number): { value: number; position: number }[] {
    return [...formChart(Array.from({ length: count }, () => 50), size).gameLabels];
  }

  it('labels a single game in the middle, like the point', () => {
    expect(labels(1)).toEqual([{ value: 1, position: 60 }]);
  });

  it('labels every game up to 10 games', () => {
    expect(labels(10).map((tick) => tick.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(labels(10).at(-1)?.position).toBe(110);
  });

  it('labels every other game for 20 games, starting at game 1', () => {
    const chart = formChart(Array.from({ length: 20 }, () => 50), size);
    expect(chart.gameLabels.map((tick) => tick.value)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19]);
    expect(chart.gameLabels.map((tick) => tick.position)).toEqual(chart.points.filter((_, index) => index % 2 === 0).map((point) => point.x));
  });
});
