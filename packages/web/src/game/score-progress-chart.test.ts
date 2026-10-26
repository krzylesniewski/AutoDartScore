import type { LegProgress } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { scoreProgressChart } from './score-progress-chart';

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
          ],
        },
      ]),
      size,
    );
    expect(chart.maxDarts).toBe(2);
    expect(chart.lines[0]?.points[1]).toEqual({ x: 60, y: 60, remaining: 0, bust: false });
    expect(chart.lines[1]?.points.at(-1)).toEqual({ x: 110, y: 10, remaining: 301, bust: false });
    expect(chart.lines[0]?.path).toBe('M10 10 L60 60');
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
    expect(chart.maxDarts).toBe(1);
    expect(chart.lines).toEqual([{ playerId: 'p1', points: [{ x: 10, y: 10, remaining: 301, bust: false }], path: '' }]);
  });

  it('rounds the coordinates to 2 decimals', () => {
    const points = [1, 2, 3].map((dart) => ({ dart, remaining: 301 - dart * 100, bust: false }));
    const chart = scoreProgressChart(progress([{ playerId: 'p1', points }]), size);
    expect(chart.lines[0]?.points.map((point) => point.x)).toEqual([10, 43.33, 76.67, 110]);
    expect(chart.lines[0]?.points.map((point) => point.y)).toEqual([10, 26.61, 43.22, 59.83]);
  });
});
