import type { PlayerFormPoint } from '@autoscore/schema';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { pl } from '../i18n/pl';
import { FormChart } from './FormChart';

function form(averages: readonly number[]): PlayerFormPoint[] {
  return averages.map((average, index) => ({ matchId: `m${index + 1}`, type: 'match', createdAt: '2026-10-15T18:30:00.000Z', average, legs: 1 }));
}

function chart(): HTMLElement {
  return screen.getByRole('img', { name: /^Wykres formy/ });
}

function axisLabels(container: HTMLElement): (string | null)[][] {
  return [...container.querySelectorAll('[aria-hidden="true"]')].map((axis) => [...axis.querySelectorAll('span.absolute')].map((label) => label.textContent));
}

describe('FormChart', () => {
  it('shows the empty state without games', () => {
    render(<FormChart points={[]} />);
    expect(screen.getByText(pl.formEmpty)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('draws one horizontal grid line per round average, under the line', () => {
    render(<FormChart points={form([40, 80, 60])} />);
    const lines = [...chart().querySelectorAll('line')];
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line.getAttribute('y1')).toBe(line.getAttribute('y2'));
      expect(line.getAttribute('class')).toBe('stroke-(--color-border)');
      expect(line.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }
    const children = [...chart().children].map((child) => child.tagName.toLowerCase());
    expect(children.lastIndexOf('line')).toBeLessThan(children.indexOf('path'));
  });

  it('labels the grid lines with averages and the games with numbers, hidden from screen readers', () => {
    const { container } = render(<FormChart points={form([40, 80, 60])} />);
    const labels = axisLabels(container);
    expect(labels).toContainEqual(['40,00', '50,00', '60,00', '70,00', '80,00']);
    expect(labels).toContainEqual(['1', '2', '3']);
    expect(chart().querySelector('text')).toBeNull();
  });

  it('labels every other game for 20 games', () => {
    const { container } = render(<FormChart points={form(Array.from({ length: 20 }, (_, index) => 40 + index))} />);
    expect(axisLabels(container)).toContainEqual(['1', '3', '5', '7', '9', '11', '13', '15', '17', '19']);
  });

  it('keeps the chart name and the list for screen readers', () => {
    render(<FormChart points={form([45.5, 60.25])} />);
    expect(chart().getAttribute('aria-label')).toBe('Wykres formy: 2 gry, ostatnia średnia 60,25');
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([pl.formPoint(1, '45,50'), pl.formPoint(2, '60,25')]);
  });
});
