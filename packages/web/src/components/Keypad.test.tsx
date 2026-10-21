import type { Hit } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DARTBOARD_ORDER } from '../game/dartboard-order';
import { type KeypadLayout } from '../game/keypad-layout';
import { ringKeyPosition } from '../game/keypad-ring';
import { Keypad } from './Keypad';
import { HIT_FLASH_MS } from './KeypadKey';

const SEGMENTS = DARTBOARD_ORDER.map(String);
const SHOW_GRID = 'Pokaż klawiaturę jako siatkę';
const SHOW_RING = 'Pokaż klawiaturę jako koło';
const LAYOUTS: readonly KeypadLayout[] = ['ring', 'grid'];

function setup({ layout = 'ring', disabled = false }: { layout?: KeypadLayout; disabled?: boolean } = {}) {
  if (layout === 'grid') {
    localStorage.setItem('autoscore.keypadLayout', 'grid');
  }
  const onHit = vi.fn<(hit: Hit) => void>();
  const onRestMiss = vi.fn<() => void>();
  render(<Keypad onHit={onHit} onRestMiss={onRestMiss} disabled={disabled} />);
  const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  return { onHit, onRestMiss, button };
}

function classes(element: HTMLElement): string[] {
  return element.className.split(' ').filter(Boolean);
}

function buttonNames(): string[] {
  return screen.getAllByRole('button').map((element) => element.getAttribute('aria-label') ?? element.textContent ?? '');
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

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

  describe.each(LAYOUTS)('25 and Bull in the %s layout', (layout) => {
    it.each(['S', 'D', 'T'])('send 25×1 and 25×2 under %s and reset the toggle to S', (name) => {
      const { onHit, button } = setup({ layout });
      fireEvent.click(button(name));
      expect(button('25').disabled).toBe(false);
      fireEvent.click(button('25'));
      expect(onHit).toHaveBeenLastCalledWith({ segment: 25, multiplier: 1 });
      expect(button('S').getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(button(name));
      expect(button('Bull').disabled).toBe(false);
      fireEvent.click(button('Bull'));
      expect(onHit).toHaveBeenLastCalledWith({ segment: 25, multiplier: 2 });
      expect(button('S').getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('sends a miss', () => {
    const { onHit, button } = setup();
    fireEvent.click(button('Miss'));
    expect(onHit).toHaveBeenCalledWith({ segment: 0, multiplier: 0 });
  });

  it.each(LAYOUTS)('renders each of the 28 keys once in the %s layout', (layout) => {
    setup({ layout });
    expect(screen.getAllByRole('button')).toHaveLength(28);
    for (const name of ['S', 'D', 'T', layout === 'ring' ? SHOW_GRID : SHOW_RING, '25', 'Bull', 'Miss', 'Reszta Miss', ...SEGMENTS]) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
    }
  });

  it.each(LAYOUTS)('orders the %s layout from the multiplier to 1-20 in dartboard order and the misses', (layout) => {
    setup({ layout });
    expect(buttonNames()).toEqual(['S', 'D', 'T', layout === 'ring' ? SHOW_GRID : SHOW_RING, ...SEGMENTS, '25', 'Bull', 'Miss', 'Reszta Miss']);
    expect(within(screen.getByRole('group', { name: 'Mnożnik' })).getAllByRole('button').map((element) => element.textContent)).toEqual(['S', 'D', 'T']);
  });

  it('lays out 1-20 five per row below lg and ten per row from lg in the grid layout', () => {
    const { button } = setup({ layout: 'grid' });
    expect(classes(button('20').parentElement as HTMLElement)).toEqual(expect.arrayContaining(['grid-cols-5', 'lg:grid-cols-10']));
    for (const name of SEGMENTS) {
      expect(classes(button(name))).toEqual(expect.arrayContaining(['h-14', 'lg:h-[78px]']));
      expect(classes(button(name)).some((name) => name.startsWith('xl:'))).toBe(false);
    }
  });

  it('puts each ring key at its ring position', () => {
    const { button } = setup();
    DARTBOARD_ORDER.forEach((segment, index) => {
      const { left, top } = ringKeyPosition(index);
      const key = button(String(segment));
      expect(classes(key)).toContain('rounded-full');
      expect(parseFloat(key.style.left)).toBeCloseTo(left, 6);
      expect(parseFloat(key.style.top)).toBeCloseTo(top, 6);
      expect(key.style.left.endsWith('%')).toBe(true);
      expect(key.style.top.endsWith('%')).toBe(true);
    });
  });

  it('gives key 20 on the ring a brighter idle border than the other keys', () => {
    const { button } = setup();
    expect(classes(button('20'))).toContain('border-(--color-text-muted)');
    expect(classes(button('20'))).not.toContain('border-(--color-border-strong)');
    expect(classes(button('1'))).toContain('border-(--color-border-strong)');
  });

  it('sends Reszta Miss and resets the toggle to S', () => {
    const { onHit, onRestMiss, button } = setup();
    fireEvent.click(button('D'));
    fireEvent.click(button('Reszta Miss'));
    expect(onRestMiss).toHaveBeenCalledTimes(1);
    expect(onHit).not.toHaveBeenCalled();
    expect(button('S').getAttribute('aria-pressed')).toBe('true');
  });

  it('does nothing on Reszta Miss when the keypad is disabled', () => {
    const { onRestMiss, button } = setup({ disabled: true });
    expect(button('Reszta Miss').disabled).toBe(true);
    fireEvent.click(button('Reszta Miss'));
    expect(onRestMiss).not.toHaveBeenCalled();
  });

  describe('layout switch', () => {
    it('shows the ring by default and switches to the grid and back', () => {
      const { button } = setup();
      expect(classes(button('20'))).toContain('rounded-full');
      expect(button(SHOW_GRID).textContent).toBe('Siatka');

      fireEvent.click(button(SHOW_GRID));
      expect(classes(button('20'))).not.toContain('rounded-full');
      expect(button(SHOW_RING).textContent).toBe('Koło');
      expect(localStorage.getItem('autoscore.keypadLayout')).toBe('grid');

      fireEvent.click(button(SHOW_RING));
      expect(classes(button('20'))).toContain('rounded-full');
      expect(localStorage.getItem('autoscore.keypadLayout')).toBe('ring');
    });

    it('renders the grid from a stored grid entry', () => {
      const { button } = setup({ layout: 'grid' });
      expect(classes(button('20'))).not.toContain('rounded-full');
      expect(button(SHOW_RING)).toBeTruthy();
    });

    it('keeps the multiplier across a switch', () => {
      const { onHit, button } = setup();
      fireEvent.click(button('T'));
      fireEvent.click(button(SHOW_GRID));
      expect(button('T').getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(button('19'));
      expect(onHit).toHaveBeenCalledWith({ segment: 19, multiplier: 3 });
    });

    it('switches when localStorage throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const { button } = setup();
      fireEvent.click(button(SHOW_GRID));
      expect(classes(button('20'))).not.toContain('rounded-full');
      expect(button(SHOW_RING)).toBeTruthy();
    });

    it('stays enabled on a disabled keypad', () => {
      const { button } = setup({ disabled: true });
      expect(button(SHOW_GRID).disabled).toBe(false);
      fireEvent.click(button(SHOW_GRID));
      expect(button(SHOW_RING).disabled).toBe(false);
      expect(button('20').disabled).toBe(true);
    });

    it('is a plain button with touch-manipulation and at least 44 px', () => {
      const { button } = setup();
      expect(button(SHOW_GRID).getAttribute('type')).toBe('button');
      expect(classes(button(SHOW_GRID))).toEqual(expect.arrayContaining(['touch-manipulation', 'min-h-11', 'min-w-11']));
    });
  });

  describe.each(LAYOUTS)('feedback in the %s layout', (layout) => {
    function renderKeypad(disabled: boolean) {
      if (layout === 'grid') {
        localStorage.setItem('autoscore.keypadLayout', 'grid');
      }
      const onHit = vi.fn<(hit: Hit) => void>();
      const onRestMiss = vi.fn<() => void>();
      const view = render(<Keypad onHit={onHit} onRestMiss={onRestMiss} disabled={disabled} />);
      const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
      const rerender = (next: boolean) => view.rerender(<Keypad onHit={onHit} onRestMiss={onRestMiss} disabled={next} />);
      return { onHit, button, rerender };
    }

    function expectOneColorPerGroup(element: HTMLElement): void {
      expect(classes(element).filter((name) => /^bg-/.test(name))).toHaveLength(1);
      expect(classes(element).filter((name) => /^border-\(--color-/.test(name))).toHaveLength(1);
      expect(classes(element).filter((name) => /^text-\(--color-/.test(name))).toHaveLength(1);
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
        expect.arrayContaining(['bg-(--color-surface-active)', 'text-(--color-text)', 'border-(--color-text)', 'motion-safe:scale-96']),
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

    it('flashes Miss, Reszta Miss, 25 and Bull but not a multiplier key', () => {
      const { button } = renderKeypad(false);
      for (const name of ['Miss', 'Reszta Miss', '25', 'Bull']) {
        fireEvent.click(button(name));
        expect(button(name).hasAttribute('data-flash')).toBe(true);
      }
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

    it('presses 25 and Bull under T', () => {
      const { button } = renderKeypad(false);
      for (const name of ['25', 'Bull']) {
        fireEvent.click(button('T'));
        fireEvent.pointerDown(button(name));
        expect(button(name).hasAttribute('data-pressed')).toBe(true);
        fireEvent.pointerUp(button(name));
      }
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

    it('cancels the flash timer when the keypad is disabled during the flash', () => {
      vi.useFakeTimers();
      const { button, rerender } = renderKeypad(false);
      fireEvent.click(button('20'));
      expect(vi.getTimerCount()).toBe(1);
      rerender(true);
      expect(button('20').hasAttribute('data-flash')).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each(['20', '1', '25', 'Bull', 'Miss', 'Reszta Miss', 'D', 'S'])('gives %s one background and one border color in every state', (name) => {
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
