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

  it('draws no board rings in the background', () => {
    const { container } = render(<Stage light="game">treść</Stage>);
    expect(container.querySelector('svg')).toBeNull();
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
