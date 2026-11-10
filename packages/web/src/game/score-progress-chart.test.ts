import type { LegProgress } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { dartLabelStep, scoreGridStep, scoreProgressChart } from './score-progress-chart';

const size = { width: 120, height: 70, padding: 10 };

function progress(players: LegProgress['players']): LegProgress {
  return { legIndex: 0, startingScore: 301, players };
}

describe('scoreProgressChart', () => {
  it('starts every line at dart 0 with the starting score', () => {
    const chart = scoreProgressChart(progress([{ playerId: 'p1', points: [{ dart: 1, remaining: 241, bust: false }] }]), size);
    expect(chart.lines[0]?.points[0]).toEqual({ x: 10, y: 10, remaining: 301, bust: false });
  });

  it('maps the starting score to the top, 0 to the bottom and the longest line to the right edge', () => {
    const chart = scoreProgressChart(
      progress([
        { playerId: 'p1', points: [{ dart: 1, remaining: 0, bust: false }] },
        {
          playerId: 'p2',
          points: [
            { dart: 1, remaining: 301, bust: false },
            { dart: 2, remaining: 301, bust: false },
            { dart: 3, remaining: 301, bust: false },
          ],
        },
      ]),
      size,
    );
    expect(chart.maxDarts).toBe(3);
    expect(chart.lines[0]?.points[1]).toEqual({ x: 43.33, y: 60, remaining: 0, bust: false });
    expect(chart.lines[1]?.points.at(-1)).toEqual({ x: 110, y: 10, remaining: 301, bust: false });
    expect(chart.lines[0]?.path).toBe('M10 10 L43.33 60');
  });

  it('draws a bust point back up at the score before the turn', () => {
    const chart = scoreProgressChart(
      progress([
        {
          playerId: 'p1',
          points: [
            { dart: 1, remaining: 241, bust: false },
            { dart: 2, remaining: 181, bust: false },
            { dart: 3, remaining: 241, bust: true },
          ],
        },
      ]),
      { width: 130, height: 321, padding: 10 },
    );
    const [start, first, second, bust] = chart.lines[0]?.points ?? [];
    expect([start?.y, first?.y, second?.y, bust?.y]).toEqual([10, 70, 130, 70]);
    expect(bust).toMatchObject({ x: 120, remaining: 241, bust: true });
  });

  it('gives a player without darts only the start point and no line', () => {
    const chart = scoreProgressChart(progress([{ playerId: 'p1', points: [] }]), size);
    expect(chart.maxDarts).toBe(3);
    expect(chart.lines).toEqual([{ playerId: 'p1', points: [{ x: 10, y: 10, remaining: 301, bust: false }], path: '' }]);
  });

  it('rounds the coordinates to 2 decimals', () => {
    const points = [1, 2, 3].map((dart) => ({ dart, remaining: 301 - dart * 100, bust: false }));
    const chart = scoreProgressChart(progress([{ playerId: 'p1', points }]), size);
    expect(chart.lines[0]?.points.map((point) => point.x)).toEqual([10, 43.33, 76.67, 110]);
    expect(chart.lines[0]?.points.map((point) => point.y)).toEqual([10, 26.61, 43.22, 59.83]);
  });
});

function darts(count: number, startingScore: LegProgress['startingScore'] = 301): LegProgress {
  const points = Array.from({ length: count }, (_, index) => ({ dart: index + 1, remaining: startingScore, bust: false }));
  return { legIndex: 0, startingScore, players: [{ playerId: 'p1', points }] };
}

function values(ticks: readonly { value: number }[]): number[] {
  return ticks.map((tick) => tick.value);
}

describe('scoreProgressChart: darts axis', () => {
  it.each([
    [0, 3],
    [2, 3],
    [6, 6],
    [29, 30],
    [60, 60],
  ])('rounds %i darts up to %i, a full turn', (count, maxDarts) => {
    expect(scoreProgressChart(darts(count), size).maxDarts).toBe(maxDarts);
  });

  it.each([
    [30, 3],
    [36, 3],
    [39, 6],
    [60, 6],
    [102, 12],
  ])('labels %i darts every %i darts', (maxDarts, step) => {
    expect(dartLabelStep(maxDarts)).toBe(step);
  });

  it('draws a grid line every turn and labels a short leg every 3 darts', () => {
    const chart = scoreProgressChart(darts(5), size);
    expect(values(chart.dartGrid)).toEqual([0, 3, 6]);
    expect(values(chart.dartLabels)).toEqual([0, 3, 6]);
  });

  it('labels a 60-dart leg every 6 darts, with a grid line every turn', () => {
    const chart = scoreProgressChart(darts(60), size);
    expect(values(chart.dartLabels)).toEqual([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]);
    expect(chart.dartGrid).toHaveLength(21);
  });

  it('keeps at most 12 labels after 0 and labels the axis end only on a step', () => {
    for (let count = 1; count <= 120; count += 1) {
      const labels = scoreProgressChart(darts(count), size).dartLabels;
      expect(labels.length - 1).toBeLessThanOrEqual(12);
      expect(labels[0]?.value).toBe(0);
    }
    expect(values(scoreProgressChart(darts(39), size).dartLabels)).toEqual([0, 6, 12, 18, 24, 30, 36]);
  });

  it('puts the axis end tick at the right edge, like the last point', () => {
    const chart = scoreProgressChart(darts(6), size);
    expect(chart.dartGrid.at(-1)).toEqual({ value: 6, position: size.width - size.padding });
    expect(chart.dartGrid.at(-1)?.position).toBe(chart.lines[0]?.points.at(-1)?.x);
    expect(chart.dartGrid[0]?.position).toBe(size.padding);
  });
});

describe('scoreProgressChart: score axis', () => {
  it.each([
    [301, 50],
    [501, 100],
    [701, 100],
  ])('draws a grid line every %i points for %i', (startingScore, step) => {
    expect(scoreGridStep(startingScore)).toBe(step);
  });

  const labelCases: readonly (readonly [LegProgress['startingScore'], readonly number[], number])[] = [
    [301, [301, 250, 200, 150, 100, 50, 0], 300],
    [501, [501, 400, 300, 200, 100, 0], 500],
    [701, [701, 600, 500, 400, 300, 200, 100, 0], 700],
  ];

  it.each(labelCases)('labels %i without the step value right under it', (startingScore, labels, hidden) => {
    const chart = scoreProgressChart(darts(3, startingScore), size);
    expect(values(chart.scoreLabels)).toEqual(labels);
    expect(values(chart.scoreLabels)).not.toContain(hidden);
    expect(values(chart.scoreGrid)).toContain(hidden);
  });

  it('draws the score grid from 0 to the starting score', () => {
    expect(values(scoreProgressChart(darts(3), size).scoreGrid)).toEqual([0, 50, 100, 150, 200, 250, 300, 301]);
  });

  it('puts the starting score tick at the start point and 0 at the bottom', () => {
    const chart = scoreProgressChart(darts(3), size);
    expect(chart.scoreLabels[0]).toEqual({ value: 301, position: chart.lines[0]?.points[0]?.y });
    expect(chart.scoreGrid[0]).toEqual({ value: 0, position: size.height - size.padding });
    expect(chart.scoreGrid.find((tick) => tick.value === 150)?.position).toBe(35.08);
  });
});
