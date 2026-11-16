import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pl } from '../i18n/pl';
import { checkoutHistory, checkoutSession } from '../test/snapshots';
import { CheckoutActions, CheckoutRecentAttempts, CheckoutTargetCard, type CheckoutActionsProps } from './CheckoutPracticePanel';
import { CheckoutPracticeSummary } from './CheckoutPracticeSummary';
import { HIT_FLASH_MS } from './KeypadKey';

// 7 udanych z 12, ostatnia próba nieudana.
const SEVEN_OF_TWELVE = [true, true, false, true, false, true, false, true, false, true, true, false];

function actions(overrides: Partial<CheckoutActionsProps> = {}) {
  const props: CheckoutActionsProps = {
    resultsDisabled: false,
    skipDisabled: false,
    undoDisabled: false,
    busy: false,
    onResult: vi.fn(),
    onSkip: vi.fn(),
    onUndo: vi.fn(),
    ...overrides,
  };
  const { rerender } = render(<CheckoutActions {...props} />);
  return { ...props, rerender: (next: Partial<CheckoutActionsProps>) => rerender(<CheckoutActions {...props} {...next} />) };
}

const BUTTONS = ['Udało się', 'Nie udało się', 'Nowa końcówka', 'Cofnij'];
const SHORTCUTS = [
  { key: 'Enter', name: 'Udało się' },
  { key: '1', name: 'Udało się' },
  { key: '0', name: 'Nie udało się' },
  { key: 'n', name: 'Nowa końcówka' },
  { key: 'Backspace', name: 'Cofnij' },
];

function pressKey(key: string): void {
  fireEvent.keyDown(window, { key });
}

function expectNoFeedback(element: HTMLElement): void {
  expect(element.hasAttribute('data-flash')).toBe(false);
  expect(element.hasAttribute('data-pressed')).toBe(false);
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name });
}

function rows(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('listitem')
    .map((row) => row.textContent ?? '');
}

describe('CheckoutTargetCard', () => {
  it('shows the target, the 3-dart route and the counter', () => {
    render(<CheckoutTargetCard session={checkoutSession(checkoutHistory(SEVEN_OF_TWELVE), { target: 100 })} />);
    const card = screen.getByRole('region', { name: 'Końcówka' });
    expect(within(card).getByText('100')).toBeTruthy();
    expect(within(card).getByText('T20')).toBeTruthy();
    expect(within(card).getByText('D20')).toBeTruthy();
    expect(within(card).getByText('7 z 12 · 58%')).toBeTruthy();
  });

  it('labels a single-dart route with hitLabel', () => {
    render(<CheckoutTargetCard session={checkoutSession([], { target: 50 })} />);
    expect(screen.getByText('Bull')).toBeTruthy();
    expect(screen.getByText('0 z 0 · —')).toBeTruthy();
  });

  it('shows the route darts in order after the dart count', () => {
    render(<CheckoutTargetCard session={checkoutSession([], { target: 100 })} />);
    const card = screen.getByRole('region', { name: 'Końcówka' });
    const label = within(card).getByText(pl.checkoutInDarts(2));
    const first = within(card).getByText('T20');
    const second = within(card).getByText('D20');
    expect(label.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('CheckoutActions', () => {
  it('names each result and Nowa końcówka with an icon and text', () => {
    actions();
    for (const name of ['Udało się', 'Nie udało się', 'Nowa końcówka']) {
      expect(button(name).querySelector('svg')).toBeTruthy();
      expect(button(name).textContent).toContain(name);
    }
  });

  it('reports a success and a failure', () => {
    const props = actions();
    fireEvent.click(button('Udało się'));
    fireEvent.click(button('Nie udało się'));
    expect(props.onResult).toHaveBeenNthCalledWith(1, true);
    expect(props.onResult).toHaveBeenNthCalledWith(2, false);
  });

  it('has shortcut hints on every button', () => {
    actions();
    expect(button('Udało się').title).toBe('Skrót: Enter albo 1');
    expect(button('Udało się').getAttribute('aria-keyshortcuts')).toBe('Enter 1');
    expect(button('Nie udało się').title).toBe('Skrót: 0');
    expect(button('Nie udało się').getAttribute('aria-keyshortcuts')).toBe('0');
    expect(button('Nowa końcówka').title).toBe('Skrót: N');
    expect(button('Nowa końcówka').getAttribute('aria-keyshortcuts')).toBe('N');
    expect(button('Cofnij').title).toBe('Skrót: Backspace');
    expect(button('Cofnij').getAttribute('aria-keyshortcuts')).toBe('Backspace');
  });

  it('puts Nowa końcówka and Cofnij after the results in the reading order', () => {
    actions();
    const names = ['Nie udało się', 'Udało się', 'Nowa końcówka', 'Cofnij'];
    for (let index = 1; index < names.length; index += 1) {
      const previous = button(names[index - 1] as string);
      expect(previous.compareDocumentPosition(button(names[index] as string)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('reports a skip once on a click and once on N', () => {
    const props = actions();
    fireEvent.click(button('Nowa końcówka'));
    expect(props.onSkip).toHaveBeenCalledOnce();
    pressKey('N');
    expect(props.onSkip).toHaveBeenCalledTimes(2);
    expect(props.onResult).not.toHaveBeenCalled();
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  it('ignores a held N', () => {
    const props = actions();
    fireEvent.keyDown(window, { key: 'n', repeat: true });
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('disables Nowa końcówka with skipDisabled and leaves N to the browser', () => {
    const props = actions({ skipDisabled: true });
    expect(button('Nowa końcówka').disabled).toBe(true);
    expect(button('Udało się').disabled).toBe(false);
    fireEvent.click(button('Nowa końcówka'));
    expect(fireEvent.keyDown(window, { key: 'n' })).toBe(true);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('ignores clicks while a command is in flight', () => {
    const props = actions({ busy: true });
    fireEvent.click(button('Udało się'));
    fireEvent.click(button('Nie udało się'));
    fireEvent.click(button('Nowa końcówka'));
    fireEvent.click(button('Cofnij'));
    expect(props.onResult).not.toHaveBeenCalled();
    expect(props.onSkip).not.toHaveBeenCalled();
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  it('disables the results and Cofnij separately', () => {
    actions({ resultsDisabled: true, undoDisabled: false });
    expect(button('Udało się').disabled).toBe(true);
    expect(button('Nie udało się').disabled).toBe(true);
    expect(button('Cofnij').disabled).toBe(false);
  });

  describe('press feedback', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it.each(BUTTONS)('flashes %s after a click for HIT_FLASH_MS', (name) => {
      vi.useFakeTimers();
      actions();
      fireEvent.click(button(name));
      expect(button(name).hasAttribute('data-flash')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(HIT_FLASH_MS - 1);
      });
      expect(button(name).hasAttribute('data-flash')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(button(name).hasAttribute('data-flash')).toBe(false);
    });

    it.each(BUTTONS)('shows %s as pressed between pointer down and up', (name) => {
      actions();
      fireEvent.pointerDown(button(name));
      expect(button(name).hasAttribute('data-pressed')).toBe(true);
      fireEvent.pointerUp(button(name));
      expect(button(name).hasAttribute('data-pressed')).toBe(false);
    });

    it.each(SHORTCUTS)('flashes $name on $key', ({ key, name }) => {
      const props = actions();
      pressKey(key);
      expect(button(name).hasAttribute('data-flash')).toBe(true);
      if (name === 'Cofnij') {
        expect(props.onUndo).toHaveBeenCalledOnce();
        expect(props.onResult).not.toHaveBeenCalled();
        expect(props.onSkip).not.toHaveBeenCalled();
      } else if (name === 'Nowa końcówka') {
        expect(props.onSkip).toHaveBeenCalledOnce();
        expect(props.onResult).not.toHaveBeenCalled();
        expect(props.onUndo).not.toHaveBeenCalled();
      } else {
        expect(props.onResult).toHaveBeenCalledExactlyOnceWith(name === 'Udało się');
        expect(props.onSkip).not.toHaveBeenCalled();
        expect(props.onUndo).not.toHaveBeenCalled();
      }
    });

    it('gives disabled buttons no feedback and calls nothing on click or shortcut', () => {
      const props = actions({ resultsDisabled: true, skipDisabled: true, undoDisabled: true });
      for (const name of BUTTONS) {
        fireEvent.pointerDown(button(name));
        fireEvent.click(button(name));
        expectNoFeedback(button(name));
      }
      for (const { key, name } of SHORTCUTS) {
        pressKey(key);
        expectNoFeedback(button(name));
      }
      expect(props.onResult).not.toHaveBeenCalled();
      expect(props.onSkip).not.toHaveBeenCalled();
      expect(props.onUndo).not.toHaveBeenCalled();
    });

    it('gives no feedback while a command is in flight and keeps the buttons enabled', () => {
      const props = actions({ busy: true });
      for (const name of BUTTONS) {
        expect(button(name).disabled).toBe(false);
        fireEvent.pointerDown(button(name));
        fireEvent.click(button(name));
        expectNoFeedback(button(name));
      }
      for (const { key, name } of SHORTCUTS) {
        pressKey(key);
        expectNoFeedback(button(name));
      }
      expect(props.onResult).not.toHaveBeenCalled();
      expect(props.onSkip).not.toHaveBeenCalled();
      expect(props.onUndo).not.toHaveBeenCalled();
    });

    it('keeps a started flash when the command turns busy right after the click', () => {
      vi.useFakeTimers();
      const props = actions();
      fireEvent.click(button('Udało się'));
      props.rerender({ busy: true });
      expect(button('Udało się').hasAttribute('data-flash')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(HIT_FLASH_MS);
      });
      expect(button('Udało się').hasAttribute('data-flash')).toBe(false);
    });

    it('flashes the failure button on a click', () => {
      actions();
      expectNoFeedback(button('Nie udało się'));
      fireEvent.click(button('Nie udało się'));
      expect(button('Nie udało się').hasAttribute('data-flash')).toBe(true);
    });
  });
});

describe('CheckoutRecentAttempts', () => {
  it('lists the last 5 attempts, newest first, with icon and text', () => {
    render(<CheckoutRecentAttempts session={checkoutSession(checkoutHistory(SEVEN_OF_TWELVE))} />);
    const list = screen.getByRole('list');
    expect(rows(list)).toEqual(['12.13Nie udało się', '11.12Udało się', '10.11Udało się', '9.10Nie udało się', '8.9Udało się']);
    for (const row of within(list).getAllByRole('listitem')) {
      expect(row.querySelector('svg')).toBeTruthy();
    }
  });

  it('keeps the region name without the newest-first hint', () => {
    render(<CheckoutRecentAttempts session={checkoutSession()} />);
    const region = screen.getByRole('region', { name: 'Ostatnie próby' });
    expect(within(region).getByText('najnowsza na górze').closest('h2')).toBeNull();
  });

  it('replaces Brak prób with the list from the first attempt', () => {
    const { rerender } = render(<CheckoutRecentAttempts session={checkoutSession()} />);
    expect(screen.getByText('Brak prób')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    rerender(<CheckoutRecentAttempts session={checkoutSession(checkoutHistory([true]))} />);
    expect(screen.queryByText('Brak prób')).toBeNull();
    expect(rows(screen.getByRole('list'))).toEqual(['1.2Udało się']);
  });
});

describe('CheckoutPracticeSummary', () => {
  it('shows the totals and every attempt in order', () => {
    render(<CheckoutPracticeSummary session={checkoutSession(checkoutHistory(SEVEN_OF_TWELVE))} />);
    const summary = screen.getByRole('region', { name: 'Podsumowanie treningu' });
    const values = within(summary).getAllByRole('definition');
    const totals = within(summary)
      .getAllByRole('term')
      .map((term, index) => [term.textContent, values[index]?.textContent]);
    expect(totals).toEqual([
      ['Próby', '12'],
      ['Udane', '7'],
      ['Skuteczność', '58%'],
    ]);
    const attempts = rows(within(summary).getByRole('list'));
    expect(attempts).toHaveLength(12);
    expect(attempts[0]).toBe('1.2Udało się');
    expect(attempts[2]).toBe('3.4Nie udało się');
    expect(attempts[11]).toBe('12.13Nie udało się');
  });

  it('shows no percent without attempts', () => {
    render(<CheckoutPracticeSummary session={checkoutSession()} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
