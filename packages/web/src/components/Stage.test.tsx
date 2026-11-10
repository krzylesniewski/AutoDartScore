import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Stage } from './Stage';

describe('Stage', () => {
  it('renders its children', () => {
    render(
      <Stage light="game">
        <h1>Nowa gra</h1>
      </Stage>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Nowa gra' })).toBeTruthy();
  });

  it('draws decorative rings hidden from screen readers and clicks', () => {
    const { container } = render(<Stage light="game">treść</Stage>);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('pointer-events')).toBe('none');
    expect(Array.from(svg?.querySelectorAll('circle') ?? [], (circle) => circle.getAttribute('r'))).toEqual(['490', '455', '430', '270', '252']);
    expect(svg?.querySelectorAll('line')).toHaveLength(20);
  });

  it('sets the light from the prop', () => {
    const { container, rerender } = render(<Stage light="list">treść</Stage>);
    expect(container.firstElementChild?.getAttribute('data-stage-light')).toBe('list');
    rerender(<Stage light="center">treść</Stage>);
    expect(container.firstElementChild?.getAttribute('data-stage-light')).toBe('center');
  });

  it('lets a child button receive a click', () => {
    const onClick = vi.fn();
    render(
      <Stage light="game">
        <button type="button" onClick={onClick}>
          Start gry
        </button>
      </Stage>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start gry' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
