import type { FrequentHit, Hit } from '@autoscore/schema';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DARTBOARD_ORDER } from '../game/dartboard-order';
import { type KeypadLayout } from '../game/keypad-layout';
import { ringKeyPosition } from '../game/keypad-ring';
import { DIGIT_WAIT_MS } from '../game/shortcut-number';
import { Keypad, type FrequentHits } from './Keypad';
import { HIT_FLASH_MS } from './KeypadKey';

const SEGMENTS = DARTBOARD_ORDER.map(String);
const SHOW_GRID = 'Pokaż klawiaturę jako siatkę';
const SHOW_RING = 'Pokaż klawiaturę jako koło';
const LAYOUTS: readonly KeypadLayout[] = ['ring', 'grid'];

interface SetupOptions {
  layout?: KeypadLayout;
  disabled?: boolean;
  undoDisabled?: boolean;
  checkout?: Hit | null;
  frequent?: FrequentHits | null;
}

function setup({ layout = 'ring', disabled = false, undoDisabled = false, checkout = null, frequent = null }: SetupOptions = {}) {
  if (layout === 'grid') {
    localStorage.setItem('autoscore.keypadLayout', 'grid');
  }
  const onHit = vi.fn<(hit: Hit) => void>();
  const onRestMiss = vi.fn<() => void>();
  const onUndo = vi.fn<() => void>();
  const keypad = (next: SetupOptions) => (
    <Keypad
      onHit={onHit}
      onRestMiss={onRestMiss}
      onUndo={onUndo}
      disabled={next.disabled ?? disabled}
      undoDisabled={next.undoDisabled ?? undoDisabled}
      checkout={next.checkout === undefined ? checkout : next.checkout}
      frequent={frequent}
    />
  );
  const view = render(keypad({}));
  const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  const rerender = (next: SetupOptions) => view.rerender(keypad(next));
  return { onHit, onRestMiss, onUndo, button, rerender };
}

function classes(element: HTMLElement): string[] {
  return element.className.split(' ').filter(Boolean);
}

// Tekst bez odznak skrótów, które są aria-hidden i nie należą do nazwy.
function visibleText(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent;
}

function buttonNames(): string[] {
  return screen.getAllByRole('button').map((element) => element.getAttribute('aria-label') ?? visibleText(element));
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
    expect(within(screen.getByRole('group', { name: 'Mnożnik' })).getAllByRole('button').map(visibleText)).toEqual(['S', 'D', 'T']);
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
      const onUndo = vi.fn<() => void>();
      const keypad = (next: boolean) => <Keypad onHit={onHit} onRestMiss={onRestMiss} onUndo={onUndo} disabled={next} undoDisabled={false} checkout={null} />;
      const view = render(keypad(disabled));
      const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
      const rerender = (next: boolean) => view.rerender(keypad(next));
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

  describe('keyboard shortcuts', () => {
    const MISS: Hit = { segment: 0, multiplier: 0 };

    function key(name: string, init: KeyboardEventInit = {}): boolean {
      return fireEvent.keyDown(window, { key: name, ...init });
    }

    function type(...names: string[]): void {
      for (const name of names) {
        key(name);
      }
    }

    afterEach(() => {
      vi.useRealTimers();
      for (const extra of document.querySelectorAll('body > input, body > [role="dialog"]')) {
        extra.remove();
      }
    });

    describe.each(LAYOUTS)('in the %s layout', (layout) => {
      it('sends Miss on Space', () => {
        const { onHit } = setup({ layout });
        key(' ');
        expect(onHit).toHaveBeenCalledExactlyOnceWith(MISS);
      });

      it.each(['S', 'D', 'T'])('selects %s with either letter case', (name) => {
        const { button } = setup({ layout });
        key(name === 'S' ? 'd' : 's');
        key(name.toLowerCase());
        expect(button(name).getAttribute('aria-pressed')).toBe('true');
        key(name === 'S' ? 'D' : 'S');
        key(name);
        expect(button(name).getAttribute('aria-pressed')).toBe('true');
      });

      it('sends 25 on B and Bull on Shift+B and resets the toggle to S', () => {
        const { onHit, button } = setup({ layout });
        key('t');
        key('b');
        expect(onHit).toHaveBeenLastCalledWith({ segment: 25, multiplier: 1 });
        expect(button('S').getAttribute('aria-pressed')).toBe('true');
        key('B', { shiftKey: true });
        expect(onHit).toHaveBeenLastCalledWith({ segment: 25, multiplier: 2 });
        key('B');
        expect(onHit).toHaveBeenLastCalledWith({ segment: 25, multiplier: 1 });
        expect(onHit).toHaveBeenCalledTimes(3);
      });

      it('calls onUndo on Backspace', () => {
        const { onUndo, onHit } = setup({ layout });
        key('Backspace');
        expect(onUndo).toHaveBeenCalledTimes(1);
        expect(onHit).not.toHaveBeenCalled();
      });

      it('presses and flashes the matching hit key for HIT_FLASH_MS', () => {
        vi.useFakeTimers();
        const { button } = setup({ layout });
        type('2', '0');
        expect(button('20').hasAttribute('data-flash')).toBe(true);
        expect(button('20').hasAttribute('data-pressed')).toBe(true);
        expect(classes(button('20'))).toEqual(expect.arrayContaining(['bg-(--color-surface-active)', 'border-(--color-accent)']));

        act(() => {
          vi.advanceTimersByTime(HIT_FLASH_MS - 1);
        });
        expect(button('20').hasAttribute('data-flash')).toBe(true);
        expect(button('20').hasAttribute('data-pressed')).toBe(true);

        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(button('20').hasAttribute('data-flash')).toBe(false);
        expect(button('20').hasAttribute('data-pressed')).toBe(false);
      });

      it('shows the badges and the shortcut attributes', () => {
        const { button } = setup({ layout });
        const expected: [string, string, string][] = [
          ['S', 'S', 'S'],
          ['D', 'D', 'D'],
          ['T', 'T', 'T'],
          ['25', 'B', 'B'],
          ['Bull', 'Shift+B', 'Shift+B'],
          ['Miss', 'Spacja', 'Space'],
        ];
        for (const [name, badge, keys] of expected) {
          const element = button(name);
          expect(element.getAttribute('aria-keyshortcuts')).toBe(keys);
          const badges = element.querySelectorAll('[aria-hidden="true"]');
          expect(badges).toHaveLength(1);
          expect(badges[0]?.textContent).toBe(badge);
          expect(classes(badges[0] as HTMLElement)).toEqual(expect.arrayContaining(['absolute', 'hidden', 'lg:block']));
          expect(classes(element)).toContain('relative');
        }
        for (const name of [...SEGMENTS, 'Reszta Miss', layout === 'ring' ? SHOW_GRID : SHOW_RING]) {
          expect(button(name).hasAttribute('aria-keyshortcuts')).toBe(false);
          expect(button(name).querySelector('span[aria-hidden="true"]')).toBeNull();
        }
      });
    });

    it('keeps the ring keys absolute and without relative', () => {
      const { button } = setup();
      for (const name of SEGMENTS) {
        expect(classes(button(name))).toContain('absolute');
        expect(classes(button(name))).not.toContain('relative');
      }
    });

    it.each([
      [['1', '0'], 10],
      [['2', '0'], 20],
      [['1', '9'], 19],
    ])('turns %j into %i', (digits, segment) => {
      vi.useFakeTimers();
      const { onHit } = setup();
      type(...digits);
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment, multiplier: 1 });
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS);
      });
      expect(onHit).toHaveBeenCalledTimes(1);
    });

    it('sends 3 at once', () => {
      vi.useFakeTimers();
      const { onHit } = setup();
      key('3');
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment: 3, multiplier: 1 });
    });

    it('sends a pending 1 after DIGIT_WAIT_MS', () => {
      vi.useFakeTimers();
      const { onHit } = setup();
      key('1');
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS - 1);
      });
      expect(onHit).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment: 1, multiplier: 1 });
    });

    it('sends a pending 1 at once on Enter without the checkout', () => {
      vi.useFakeTimers();
      const { onHit } = setup({ checkout: { segment: 20, multiplier: 2 } });
      type('1', 'Enter');
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment: 1, multiplier: 1 });
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS);
      });
      expect(onHit).toHaveBeenCalledTimes(1);
    });

    it('sends 2 and 5 for 2 followed by 5', () => {
      const { onHit } = setup();
      type('2', '5');
      expect(onHit.mock.calls).toEqual([[{ segment: 2, multiplier: 1 }], [{ segment: 5, multiplier: 1 }]]);
    });

    it('resets the toggle between two numbers from one key', () => {
      const { onHit } = setup();
      type('t', '2', '5');
      expect(onHit.mock.calls).toEqual([[{ segment: 2, multiplier: 3 }], [{ segment: 5, multiplier: 1 }]]);
    });

    it('sends D16 for D, 1, 6 and resets the toggle to S', () => {
      const { onHit, button } = setup();
      type('d', '1', '6');
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment: 16, multiplier: 2 });
      expect(button('S').getAttribute('aria-pressed')).toBe('true');
    });

    it('uses the toggle chosen while a digit is pending', () => {
      vi.useFakeTimers();
      const { onHit, button } = setup();
      type('1', 't');
      expect(button('T').getAttribute('aria-pressed')).toBe('true');
      expect(onHit).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS);
      });
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment: 1, multiplier: 3 });
    });

    it('sends the pending number before Space, B and Shift+B', () => {
      const { onHit } = setup();
      type('1', ' ');
      type('2', 'b');
      key('1');
      key('B', { shiftKey: true });
      expect(onHit.mock.calls).toEqual([
        [{ segment: 1, multiplier: 1 }],
        [MISS],
        [{ segment: 2, multiplier: 1 }],
        [{ segment: 25, multiplier: 1 }],
        [{ segment: 1, multiplier: 1 }],
        [{ segment: 25, multiplier: 2 }],
      ]);
    });

    it('sends the checkout dart on Enter and resets the toggle to S', () => {
      const checkout: Hit = { segment: 16, multiplier: 2 };
      const { onHit, button } = setup({ checkout });
      key('t');
      key('Enter');
      expect(onHit).toHaveBeenCalledExactlyOnceWith(checkout);
      expect(button('S').getAttribute('aria-pressed')).toBe('true');
    });

    it('does nothing on Enter without a checkout', () => {
      const { onHit, onUndo } = setup();
      key('Enter');
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('drops a pending digit on Backspace without undoing', () => {
      vi.useFakeTimers();
      const { onHit, onUndo } = setup();
      type('1', 'Backspace');
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS);
      });
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
      key('Backspace');
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('prevents the default of Space on a focused key and sends one Miss', () => {
      const { onHit, button } = setup();
      button('20').focus();
      expect(fireEvent.keyDown(button('20'), { key: ' ' })).toBe(false);
      expect(fireEvent.keyUp(button('20'), { key: ' ' })).toBe(false);
      expect(onHit).toHaveBeenCalledExactlyOnceWith(MISS);
    });

    it('prevents the default of Enter on a focused key', () => {
      const { onHit, button } = setup();
      button('20').focus();
      expect(fireEvent.keyDown(button('20'), { key: 'Enter' })).toBe(false);
      expect(onHit).not.toHaveBeenCalled();
    });

    it('leaves the keyup of an unhandled Space alone', () => {
      setup({ disabled: true });
      expect(key(' ')).toBe(true);
      expect(fireEvent.keyUp(window, { key: ' ' })).toBe(true);
    });

    it('sends nothing on a repeated keydown', () => {
      vi.useFakeTimers();
      const { onHit, onUndo } = setup({ checkout: { segment: 20, multiplier: 2 } });
      for (const name of [' ', 'b', '3', '1', 'Enter', 'Backspace']) {
        expect(key(name, { repeat: true })).toBe(false);
      }
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS);
      });
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('ignores shortcuts typed in an input', () => {
      const { onHit, onUndo } = setup();
      const input = document.createElement('input');
      document.body.append(input);
      input.focus();
      for (const name of [' ', 'b', '3', 'Backspace']) {
        expect(fireEvent.keyDown(input, { key: name })).toBe(true);
      }
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('ignores shortcuts while a dialog is open', () => {
      const { onHit, onUndo } = setup();
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.append(dialog);
      for (const name of [' ', 'b', '3', 'Backspace']) {
        expect(key(name)).toBe(true);
      }
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('ignores shortcuts on a disabled keypad', () => {
      const { onHit, onUndo } = setup({ disabled: true, checkout: { segment: 20, multiplier: 2 } });
      for (const name of [' ', 'b', '3', 'Enter', 'Backspace']) {
        expect(key(name)).toBe(true);
      }
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('drops a pending digit when the keypad is disabled', () => {
      vi.useFakeTimers();
      const { onHit, rerender } = setup();
      key('1');
      rerender({ disabled: true });
      expect(vi.getTimerCount()).toBe(0);
      rerender({ disabled: false });
      key('6');
      expect(onHit).toHaveBeenCalledExactlyOnceWith({ segment: 6, multiplier: 1 });
    });

    it('does not undo on Backspace while undo is disabled', () => {
      const { onUndo } = setup({ undoDisabled: true });
      key('Backspace');
      expect(onUndo).not.toHaveBeenCalled();
    });

    it.each(['ctrlKey', 'metaKey', 'altKey'])('ignores shortcuts while %s is held', (modifier) => {
      const { onHit, onUndo } = setup({ checkout: { segment: 20, multiplier: 2 } });
      for (const name of [' ', 'b', '3', 'Enter', 'Backspace', 'd']) {
        expect(key(name, { [modifier]: true })).toBe(true);
      }
      expect(onHit).not.toHaveBeenCalled();
      expect(onUndo).not.toHaveBeenCalled();
    });

    it('ignores an event whose default is already prevented', () => {
      const { onHit } = setup();
      const event = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
      event.preventDefault();
      fireEvent(window, event);
      expect(onHit).not.toHaveBeenCalled();
    });

    it('removes the listener on unmount', () => {
      vi.useFakeTimers();
      const { onHit } = setup();
      key('1');
      cleanup();
      act(() => {
        vi.advanceTimersByTime(DIGIT_WAIT_MS);
      });
      expect(key(' ')).toBe(true);
      expect(onHit).not.toHaveBeenCalled();
    });
  });

  describe('frequent hits', () => {
    const SIX: readonly FrequentHit[] = [
      { segment: 20, multiplier: 1, count: 9 },
      { segment: 16, multiplier: 2, count: 6 },
      { segment: 20, multiplier: 3, count: 4 },
      { segment: 25, multiplier: 2, count: 3 },
      { segment: 25, multiplier: 1, count: 2 },
      { segment: 1, multiplier: 1, count: 1 },
    ];
    const anna = (hits: readonly FrequentHit[]): FrequentHits => ({ playerName: 'Anna', hits });
    const row = () => screen.getByRole('group', { name: 'Najczęstsze: Anna' });
    const rowKey = (name: string) => within(row()).getByRole('button', { name }) as HTMLButtonElement;

    // Od lg blok stoi nad Miss w kole, a w siatce między S/D/T a 1-20.
    function reservedBlock(layout: KeypadLayout): HTMLElement {
      const anchor = layout === 'ring' ? screen.getByRole('button', { name: 'Miss' }).parentElement : screen.getByRole('button', { name: '20' }).parentElement?.previousElementSibling;
      const block = layout === 'ring' ? anchor?.firstElementChild : anchor;
      if (!(block instanceof HTMLElement)) {
        throw new Error('no reserved block');
      }
      return block;
    }

    it.each(LAYOUTS)('names the row after the thrower and labels each hit in the %s layout', (layout) => {
      setup({ layout, frequent: anna(SIX) });
      expect(within(row()).getByText('Najczęstsze: Anna')).toBeTruthy();
      expect(within(row()).getAllByRole('button').map((element) => element.textContent)).toEqual(['S20', 'D16', 'T20', 'Bull', '25', 'S1']);
      expect(screen.getAllByRole('button', { name: '25' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: 'Bull' })).toHaveLength(2);
      expect(reservedBlock(layout)).toBe(row());
    });

    it.each(LAYOUTS)('sends the exact hit under T and resets the toggle to S in the %s layout', (layout) => {
      const { onHit, button } = setup({ layout, frequent: anna(SIX) });
      fireEvent.click(button('T'));
      fireEvent.click(rowKey('S20'));
      expect(onHit).toHaveBeenLastCalledWith({ segment: 20, multiplier: 1 });
      expect(button('S').getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(button('T'));
      fireEvent.click(rowKey('D16'));
      expect(onHit).toHaveBeenLastCalledWith({ segment: 16, multiplier: 2 });
      expect(button('S').getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(rowKey('Bull'));
      expect(onHit).toHaveBeenLastCalledWith({ segment: 25, multiplier: 2 });
    });

    it.each(LAYOUTS)('disables the row keys on a disabled keypad in the %s layout', (layout) => {
      const { onHit } = setup({ layout, disabled: true, frequent: anna(SIX) });
      for (const element of within(row()).getAllByRole('button')) {
        expect((element as HTMLButtonElement).disabled).toBe(true);
      }
      fireEvent.click(rowKey('S20'));
      expect(onHit).not.toHaveBeenCalled();
    });

    it('gives the row keys at least 44 px and a smaller text than the number keys', () => {
      setup({ layout: 'grid', frequent: anna(SIX) });
      expect(classes(rowKey('Bull'))).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11', 'text-lg', 'touch-manipulation']));
      expect(classes(within(row()).getByText('Najczęstsze: Anna'))).toContain('truncate');
    });

    it.each(LAYOUTS)('reserves the same block without hits in the %s layout', (layout) => {
      setup({ layout, frequent: anna(SIX) });
      const withHits = reservedBlock(layout).className;
      cleanup();

      for (const frequent of [null, anna([]), anna(SIX.slice(0, 1))]) {
        setup({ layout, frequent });
        expect(reservedBlock(layout).className).toBe(withHits);
        if (frequent?.hits.length) {
          expect(within(row()).getAllByRole('button')).toHaveLength(1);
        } else {
          expect(reservedBlock(layout).getAttribute('aria-hidden')).toBe('true');
          expect(reservedBlock(layout).childElementCount).toBe(0);
          expect(screen.queryByRole('group', { name: /Najczęstsze/ })).toBeNull();
          expect(screen.getAllByRole('button')).toHaveLength(28);
        }
        cleanup();
      }
    });

    it('hides the block below lg in the ring layout and keeps it at a fixed height', () => {
      setup({ frequent: anna(SIX) });
      expect(classes(reservedBlock('ring'))).toEqual(expect.arrayContaining(['hidden', 'lg:flex', 'h-31', 'shrink-0']));
      expect(classes(screen.getByRole('button', { name: 'Miss' }))).toEqual(expect.arrayContaining(['lg:flex-1']));
    });

    it('keeps the block at a fixed height at every width in the grid layout', () => {
      setup({ layout: 'grid', frequent: anna(SIX) });
      expect(classes(reservedBlock('grid'))).toEqual(expect.arrayContaining(['flex', 'h-18', 'shrink-0']));
      expect(classes(reservedBlock('grid')).some((name) => name === 'hidden' || name.includes(':h-'))).toBe(false);
      expect(classes(within(row()).getAllByRole('button')[0]?.parentElement as HTMLElement)).toContain('grid-cols-6');
    });
  });
});
