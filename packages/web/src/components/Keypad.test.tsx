import type { Hit } from '@autoscore/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Keypad } from './Keypad';

function setup() {
  const onHit = vi.fn<(hit: Hit) => void>();
  render(<Keypad onHit={onHit} disabled={false} />);
  const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  return { onHit, button };
}

describe('Keypad', () => {
  it('sends a treble and resets the toggle to S', () => {
    const { onHit, button } = setup();
    fireEvent.click(button('T'));
    expect(button('T').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button('20'));
    expect(onHit).toHaveBeenCalledWith({ segment: 20, multiplier: 3 });
    expect(button('S').getAttribute('aria-pressed')).toBe('true');
    expect(button('T').getAttribute('aria-pressed')).toBe('false');
  });

  it('sends Bull with D and 25', () => {
    const { onHit, button } = setup();
    fireEvent.click(button('D'));
    fireEvent.click(button('Bull'));
    expect(onHit).toHaveBeenCalledWith({ segment: 25, multiplier: 2 });
    expect(button('25')).toBeTruthy();
  });

  it('disables 25 with T', () => {
    const { button } = setup();
    expect(button('25').disabled).toBe(false);
    fireEvent.click(button('T'));
    expect(button('25').disabled).toBe(true);
  });

  it('sends a miss', () => {
    const { onHit, button } = setup();
    fireEvent.click(button('Miss'));
    expect(onHit).toHaveBeenCalledWith({ segment: 0, multiplier: 0 });
  });
});
