import type { Hit } from '@autoscore/schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypad } from './Keypad';
import { HIT_FLASH_MS } from './KeypadKey';

const SEGMENTS = Array.from({ length: 20 }, (_, index) => String(index + 1));

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

  it('renders each of the 25 keys once', () => {
    setup();
    expect(screen.getAllByRole('button')).toHaveLength(25);
    for (const name of ['S', 'D', 'T', '25', 'Miss', ...SEGMENTS]) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
    }
  });

  it('lays out 1-20 five per row below lg and ten per row from lg', () => {
    const { button } = setup();
    for (const name of SEGMENTS) {
      expect(button(name).className.split(' ')).toEqual(expect.arrayContaining(['col-span-2', 'lg:col-span-1', 'h-14', 'xl:h-(--button-height)']));
    }
    for (const name of ['25', 'Miss']) {
      expect(button(name).className.split(' ')).toEqual(expect.arrayContaining(['order-last', 'col-span-5', 'xl:order-none', 'xl:col-span-2']));
    }
  });

  describe('feedback', () => {
    function renderKeypad(disabled: boolean) {
      const onHit = vi.fn<(hit: Hit) => void>();
      const view = render(<Keypad onHit={onHit} disabled={disabled} />);
      const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
      const rerender = (next: boolean) => view.rerender(<Keypad onHit={onHit} disabled={next} />);
      return { onHit, button, rerender };
    }

    function classes(element: HTMLElement): string[] {
      return element.className.split(' ').filter(Boolean);
    }

    function expectOneColorPerGroup(element: HTMLElement): void {
      expect(classes(element).filter((name) => /^bg-/.test(name))).toHaveLength(1);
      expect(classes(element).filter((name) => /^border-\(--color-/.test(name))).toHaveLength(1);
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each(['20', 'D'])('shows %s as pressed between pointer down and up or cancel', (name) => {
      const { button } = renderKeypad(false);
      fireEvent.pointerDown(button(name));
      expect(button(name).hasAttribute('data-pressed')).toBe(true);
      fireEvent.pointerUp(button(name));
      expect(button(name).hasAttribute('data-pressed')).toBe(false);

      fireEvent.pointerDown(button(name));
      expect(button(name).hasAttribute('data-pressed')).toBe(true);
      fireEvent.pointerCancel(button(name));
      expect(button(name).hasAttribute('data-pressed')).toBe(false);
    });

    it('clears the pressed state when the pointer leaves the key', () => {
      const { button } = renderKeypad(false);
      fireEvent.pointerDown(button('20'));
      fireEvent.pointerLeave(button('20'));
      expect(button('20').hasAttribute('data-pressed')).toBe(false);
    });

    it('ignores a pointer down with a button other than the primary one', () => {
      const { button } = renderKeypad(false);
      fireEvent.pointerDown(button('20'), { button: 2 });
      expect(button('20').hasAttribute('data-pressed')).toBe(false);
    });

    it('gives a pressed key the active colors and a motion-safe shrink', () => {
      const { button } = renderKeypad(false);
      fireEvent.pointerDown(button('20'));
      expect(classes(button('20'))).toEqual(
        expect.arrayContaining(['bg-(--color-surface-active)', 'border-(--color-text)', 'motion-safe:scale-96']),
      );
      expect(classes(button('20'))).not.toContain('scale-96');
    });

    it('keeps the cream colors on the selected multiplier while pressed', () => {
      const { button } = renderKeypad(false);
      fireEvent.pointerDown(button('S'));
      expect(classes(button('S'))).toEqual(expect.arrayContaining(['bg-(--color-text)', 'border-(--color-text)', 'motion-safe:scale-96']));
      expect(classes(button('S'))).not.toContain('bg-(--color-surface-active)');
    });

    it('flashes the hit key for the named duration', () => {
      vi.useFakeTimers();
      const { button } = renderKeypad(false);
      fireEvent.click(button('20'));
      expect(HIT_FLASH_MS).toBe(200);
      expect(button('20').hasAttribute('data-flash')).toBe(true);
      expect(classes(button('20'))).toContain('border-(--color-accent)');

      act(() => {
        vi.advanceTimersByTime(199);
      });
      expect(button('20').hasAttribute('data-flash')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(button('20').hasAttribute('data-flash')).toBe(false);
      expect(classes(button('20'))).not.toContain('border-(--color-accent)');
    });

    it('restarts the flash on a click during the flash', () => {
      vi.useFakeTimers();
      const { button } = renderKeypad(false);
      fireEvent.click(button('20'));
      act(() => {
        vi.advanceTimersByTime(150);
      });
      fireEvent.click(button('20'));
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(button('20').hasAttribute('data-flash')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(50);
      });
      expect(button('20').hasAttribute('data-flash')).toBe(false);
    });

    it('flashes Miss and 25 but not a multiplier key', () => {
      const { button } = renderKeypad(false);
      fireEvent.click(button('Miss'));
      expect(button('Miss').hasAttribute('data-flash')).toBe(true);
      fireEvent.click(button('25'));
      expect(button('25').hasAttribute('data-flash')).toBe(true);
      fireEvent.click(button('D'));
      expect(button('D').hasAttribute('data-flash')).toBe(false);
    });

    it('shows the accent border over the pressed border', () => {
      const { button } = renderKeypad(false);
      fireEvent.pointerDown(button('20'));
      fireEvent.click(button('20'));
      expect(classes(button('20'))).toEqual(expect.arrayContaining(['bg-(--color-surface-active)', 'border-(--color-accent)']));
      expect(classes(button('20'))).not.toContain('border-(--color-text)');
    });

    it('does not react on a disabled keypad', () => {
      const { onHit, button } = renderKeypad(true);
      fireEvent.pointerDown(button('20'));
      expect(button('20').hasAttribute('data-pressed')).toBe(false);
      fireEvent.click(button('20'));
      expect(onHit).not.toHaveBeenCalled();
      expect(button('20').hasAttribute('data-flash')).toBe(false);
    });

    it('does not press 25 while T disables it', () => {
      const { button } = renderKeypad(false);
      fireEvent.click(button('T'));
      fireEvent.pointerDown(button('25'));
      expect(button('25').hasAttribute('data-pressed')).toBe(false);
    });

    it('drops the pressed state when the keypad is disabled and does not bring it back', () => {
      const { button, rerender } = renderKeypad(false);
      fireEvent.pointerDown(button('20'));
      expect(button('20').hasAttribute('data-pressed')).toBe(true);
      rerender(true);
      expect(button('20').hasAttribute('data-pressed')).toBe(false);
      rerender(false);
      expect(button('20').hasAttribute('data-pressed')).toBe(false);
    });

    it.each(['20', 'Miss', 'D', 'S'])('gives %s one background and one border color in every state', (name) => {
      vi.useFakeTimers();
      const { button } = renderKeypad(false);
      expectOneColorPerGroup(button(name));

      fireEvent.pointerDown(button(name));
      expectOneColorPerGroup(button(name));

      fireEvent.click(button(name));
      expectOneColorPerGroup(button(name));

      fireEvent.pointerUp(button(name));
      expectOneColorPerGroup(button(name));

      act(() => {
        vi.advanceTimersByTime(HIT_FLASH_MS);
      });
      expectOneColorPerGroup(button(name));
    });

    it('gives every key touch-manipulation', () => {
      renderKeypad(false);
      for (const key of screen.getAllByRole('button')) {
        expect(classes(key)).toContain('touch-manipulation');
      }
    });
  });
});
