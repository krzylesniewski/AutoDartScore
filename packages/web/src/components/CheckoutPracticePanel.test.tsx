import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkoutHistory, checkoutSession } from '../test/snapshots';
import { CheckoutActions, CheckoutRecentAttempts, CheckoutTargetCard, type CheckoutActionsProps } from './CheckoutPracticePanel';
import { CheckoutPracticeSummary } from './CheckoutPracticeSummary';

// 7 udanych z 12, ostatnia próba nieudana.
const SEVEN_OF_TWELVE = [true, true, false, true, false, true, false, true, false, true, true, false];

function actions(overrides: Partial<CheckoutActionsProps> = {}) {
  const props: CheckoutActionsProps = { resultsDisabled: false, undoDisabled: false, busy: false, onResult: vi.fn(), onUndo: vi.fn(), ...overrides };
  render(<CheckoutActions {...props} />);
  return props;
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
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
    expect(within(card).getByText('T20 D20')).toBeTruthy();
    expect(within(card).getByText('7 z 12 · 58%')).toBeTruthy();
  });

  it('labels a single-dart route with hitLabel', () => {
    render(<CheckoutTargetCard session={checkoutSession([], { target: 50 })} />);
    expect(screen.getByText('Bull')).toBeTruthy();
    expect(screen.getByText('0 z 0 · —')).toBeTruthy();
  });

  it('sizes the target with clamp inside its own container', () => {
    render(<CheckoutTargetCard session={checkoutSession([], { target: 64 })} />);
    expect(screen.getByRole('region', { name: 'Końcówka' }).className.split(' ')).toContain('@container');
    expect(screen.getByText('64').className).toMatch(/text-\[clamp\(/);
  });
});

describe('CheckoutActions', () => {
  it('names each result with an icon and text', () => {
    actions();
    for (const name of ['Udało się', 'Nie udało się']) {
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
    expect(button('Cofnij').title).toBe('Skrót: Backspace');
    expect(button('Cofnij').getAttribute('aria-keyshortcuts')).toBe('Backspace');
  });

  it('keeps the result buttons at least 56 px tall, taller from lg', () => {
    actions();
    for (const name of ['Udało się', 'Nie udało się']) {
      expect(button(name).className.split(' ')).toEqual(expect.arrayContaining(['min-h-(--button-height)', 'lg:min-h-24']));
    }
    expect(button('Cofnij').className.split(' ')).toContain('min-h-12');
  });

  it('ignores clicks while a command is in flight', () => {
    const props = actions({ busy: true });
    fireEvent.click(button('Udało się'));
    fireEvent.click(button('Nie udało się'));
    fireEvent.click(button('Cofnij'));
    expect(props.onResult).not.toHaveBeenCalled();
    expect(props.onUndo).not.toHaveBeenCalled();
  });

  it('disables the results and Cofnij separately', () => {
    actions({ resultsDisabled: true, undoDisabled: false });
    expect(button('Udało się').disabled).toBe(true);
    expect(button('Nie udało się').disabled).toBe(true);
    expect(button('Cofnij').disabled).toBe(false);
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

  it('reserves the height of 5 rows from the first attempt', () => {
    const { rerender } = render(<CheckoutRecentAttempts session={checkoutSession()} />);
    expect(screen.getByText('Brak prób').className.split(' ')).toEqual(expect.arrayContaining(['h-39', 'lg:h-58']));
    rerender(<CheckoutRecentAttempts session={checkoutSession(checkoutHistory([true]))} />);
    expect(screen.getByRole('list').className.split(' ')).toEqual(expect.arrayContaining(['h-39', 'lg:h-58']));
  });
});

describe('CheckoutPracticeSummary', () => {
  it('shows the totals and every attempt in order', () => {
    render(<CheckoutPracticeSummary session={checkoutSession(checkoutHistory(SEVEN_OF_TWELVE))} />);
    const summary = screen.getByRole('region', { name: 'Podsumowanie treningu' });
    const totals = within(summary)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
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
