import { describe, expect, it } from 'vitest';
import { formChart } from './form-chart';

const size = { width: 120, height: 60, padding: 10 };

describe('formChart', () => {
  it('has no points, bounds or line without values', () => {
    expect(formChart([], size)).toEqual({ points: [], min: null, max: null, path: '' });
  });

  it('puts a single value in the middle, without a line', () => {
    expect(formChart([45.5], size)).toEqual({ points: [{ x: 60, y: 30, value: 45.5 }], min: 45.5, max: 45.5, path: '' });
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
