import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pl } from '../i18n/pl';
import { legProgress, player } from '../test/snapshots';
import { ScoreProgressChart } from './ScoreProgressChart';

// Dwóch graczy w tym samym kolorze, żeby linie różniły się tylko wzorem.
const players = [player('p1', 'Anna', { color: 3 }), player('p2', 'Bartek', { color: 3 }), player('p3', 'Celina', { color: 9 })];

const progress = legProgress(
  {
    p1: [241, 181, 121, 61, 10, 0],
    p2: [281, 221, 161, 101, 41, -161],
    p3: [],
  },
  { legIndex: 1 },
);

function chart(): HTMLElement {
  return screen.getByRole('img', { name: /^Zejście z wyniku/ });
}

describe('ScoreProgressChart', () => {
  it('names the leg in the heading', () => {
    render(<ScoreProgressChart progress={progress} players={players} />);
    expect(screen.getByRole('heading', { name: 'Leg 2 · zejście z wyniku' })).toBeTruthy();
  });

  it('lists every player in the legend', () => {
    render(<ScoreProgressChart progress={progress} players={players} />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    ['Anna', 'Bartek', 'Celina'].forEach((name, index) => {
      expect(within(items[index] as HTMLElement).getByText(name)).toBeTruthy();
    });
  });

  it('marks every bust point with the icon and Bust', () => {
    render(<ScoreProgressChart progress={legProgress({ p1: [241, 181, -241, 201, -241], p2: [301, -301] })} players={players} />);
    const busts = screen.getAllByText(pl.bust);
    expect(busts).toHaveLength(3);
    for (const bust of busts) {
      expect(bust.querySelector('svg')).not.toBeNull();
    }
  });

  it('shows no Bust without a bust point', () => {
    render(<ScoreProgressChart progress={legProgress({ p1: [241, 181] })} players={players} />);
    expect(screen.queryByText(pl.bust)).toBeNull();
  });

  it('describes the last point of each line in the aria-label', () => {
    render(<ScoreProgressChart progress={progress} players={players} />);
    expect(chart().getAttribute('aria-label')).toBe('Zejście z wyniku w legu 2: Anna 6 lotek do 0, Bartek 6 lotek do 161, Celina 0 lotek do 301');
  });

  it('declines lotka by the number of darts', () => {
    render(<ScoreProgressChart progress={legProgress({ p1: [241], p2: [281, 221] })} players={players} />);
    expect(chart().getAttribute('aria-label')).toBe('Zejście z wyniku w legu 1: Anna 1 lotka do 241, Bartek 2 lotki do 221');
  });

  it('gives each line its own dash pattern', () => {
    render(<ScoreProgressChart progress={legProgress({ p1: [241], p2: [281], p3: [301] })} players={players} />);
    const lines = [...chart().querySelectorAll('path.fill-none')];
    const dashes = lines.map((line) => line.getAttribute('stroke-dasharray'));
    expect(dashes).toHaveLength(3);
    expect(new Set(dashes).size).toBe(3);
  });

  it('draws the lines in the avatar colors', () => {
    render(<ScoreProgressChart progress={legProgress({ p1: [241], p3: [301] })} players={players} />);
    const lines = [...chart().querySelectorAll('path.fill-none')];
    expect(lines.map((line) => line.getAttribute('class'))).toEqual(['fill-none stroke-(--color-avatar-3)', 'fill-none stroke-(--color-avatar-9)']);
  });

  it('draws a grid line every turn and every 50 points inside the chart', () => {
    render(<ScoreProgressChart progress={progress} players={players} />);
    const lines = [...chart().querySelectorAll('line')];
    expect(lines).toHaveLength(11);
    const vertical = lines.filter((line) => line.getAttribute('x1') === line.getAttribute('x2'));
    expect(vertical).toHaveLength(3);
    expect(lines.filter((line) => line.getAttribute('y1') === line.getAttribute('y2'))).toHaveLength(8);
    for (const line of lines) {
      expect(line.getAttribute('class')).toBe('stroke-(--color-border)');
      expect(line.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(line.getAttribute('stroke-dasharray')).toBeNull();
    }
  });

  it('draws the grid under the player lines', () => {
    render(<ScoreProgressChart progress={progress} players={players} />);
    const children = [...chart().children].map((child) => child.tagName.toLowerCase());
    expect(children.lastIndexOf('line')).toBeLessThan(children.indexOf('g'));
  });

  it('labels the axes with numbers outside the chart, hidden from screen readers', () => {
    const { container } = render(<ScoreProgressChart progress={progress} players={players} />);
    const axes = [...container.querySelectorAll('[aria-hidden="true"]')];
    const labels = axes.map((axis) => [...axis.querySelectorAll('span.absolute')].map((label) => label.textContent));
    expect(labels).toContainEqual(['301', '250', '200', '150', '100', '50', '0']);
    expect(labels).toContainEqual(['0', '3', '6']);
    expect(chart().querySelector('text')).toBeNull();
    expect(axes.map((axis) => axis.textContent)).toEqual(expect.arrayContaining([pl.scoreProgressRemaining, pl.scoreProgressDarts]));
  });
});
