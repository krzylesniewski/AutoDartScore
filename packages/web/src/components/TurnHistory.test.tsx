import type { MatchSnapshot } from '@autoscore/schema';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { casual, checkoutPractice, legTurn, player, snapshot } from '../test/snapshots';
import { TurnHistory } from './TurnHistory';

const T20 = { segment: 20, multiplier: 3 } as const;
const S20 = { segment: 20, multiplier: 1 } as const;
const S5 = { segment: 5, multiplier: 1 } as const;

// Anna 60 i 26, Bartek 81 i bust. Anna rzuca trzecią turę.
const midLeg = snapshot({
  startingScore: 301,
  legIndex: 1,
  currentPlayerId: 'p1',
  players: [player('p1', 'Anna', { remaining: 215, legsWon: 1 }), player('p2', 'Bartek', { remaining: 220, legsWon: 0 })],
  legTurns: [
    legTurn('p1', { points: 60, remainingAfter: 241 }),
    legTurn('p2', { points: 81, remainingAfter: 220 }),
    legTurn('p1', { points: 26, remainingAfter: 215 }),
    legTurn('p2', { bust: true, remainingAfter: 220 }),
  ],
});

function soloState(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    type: 'practice',
    practiceMode: 'solo_501',
    legsToWin: null,
    countsToStats: true,
    players: [player('p1', 'Anna', { remaining: 415 })],
    legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 }), legTurn('p1', { bust: true, remainingAfter: 441 }), legTurn('p1', { points: 26, remainingAfter: 415 })],
    ...overrides,
  });
}

function freeRunState(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    type: 'practice',
    practiceMode: 'free_run',
    startingScore: null,
    legsToWin: null,
    countsToStats: false,
    round: null,
    players: [player('p1', 'Anna', { remaining: null })],
    legTurns: [legTurn('p1', { darts: [T20, S20, S5], points: 85, remainingAfter: null }), legTurn('p1', { darts: [S5, S5, S20], points: 30, remainingAfter: null, turnIndex: 1 })],
    currentDarts: [S20],
    freeRun: { dartsThrown: 7, totalPoints: 135, average: 57.86 },
    ...overrides,
  });
}

function table(): HTMLElement {
  return screen.getByRole('table', { name: 'Historia tur: wynik po turze i punkty w turze' });
}

describe('TurnHistory', () => {
  it('titles the 1v1 history with the leg number', () => {
    render(<TurnHistory state={midLeg} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Historia tur · Leg 2' })).toBeTruthy();
    expect(screen.getByText('po turze (punkty w turze)')).toBeTruthy();
  });

  it('titles the casual history without a leg', () => {
    render(<TurnHistory state={casual(['Anna', 'Bartek', 'Celina'])} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Historia tur' })).toBeTruthy();
  });

  it('names the columns with th scope col and the players in throw order', () => {
    render(<TurnHistory state={midLeg} />);
    const headers = within(table()).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Tura', 'Anna', 'Bartek']);
    for (const header of headers) {
      expect(header.getAttribute('scope')).toBe('col');
    }
  });

  it('keeps a visible copy of the headers hidden from screen readers above the scroll', () => {
    render(<TurnHistory state={midLeg} />);
    const copy = screen.getAllByText('Bartek').map((cell) => cell.closest('table') as HTMLElement);
    const hidden = copy.find((element) => element !== table());
    expect(hidden?.getAttribute('aria-hidden')).toBe('true');
    expect(table().querySelector('thead')?.className.split(' ')).toContain('sr-only');
  });

  it('shows the score after the turn and the points in brackets', () => {
    render(<TurnHistory state={midLeg} />);
    const rows = within(table()).getAllByRole('row').slice(1);
    const cells = within(rows[0] as HTMLElement).getAllByRole('cell');
    expect(cells[0]?.textContent).toBe('241 (60)');
    expect(cells[1]?.textContent).toBe('220 (81)');
    expect(cells[0]?.querySelector('small')?.textContent).toBe('(60)');
  });

  it('shows a bust with the icon and the word, without points', () => {
    render(<TurnHistory state={midLeg} />);
    const rows = within(table()).getAllByRole('row').slice(1);
    const bust = within(rows[1] as HTMLElement).getAllByRole('cell')[1] as HTMLElement;
    expect(bust.textContent).toBe('220 Bust');
    expect(bust.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(bust.querySelector('small')).toBeNull();
  });

  it('marks the current row and the thrower cell', () => {
    render(<TurnHistory state={midLeg} />);
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const current = rows[2] as HTMLElement;
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(current.className.split(' ')).toContain('bg-(--color-surface-softer)');
    expect(within(current).getByRole('rowheader').textContent).toBe('3');
    expect(within(current).getByText('rzuca teraz').className.split(' ')).toContain('sr-only');
    expect(rows.filter((row) => row.getAttribute('aria-current') === 'true')).toHaveLength(1);
  });

  it('colors the thrower column in the text color and the others in the sub color', () => {
    render(<TurnHistory state={midLeg} />);
    const cells = within(within(table()).getAllByRole('row')[1] as HTMLElement).getAllByRole('cell');
    expect(cells[0]?.className.split(' ')).toContain('text-(--color-text)');
    expect(cells[1]?.className.split(' ')).toContain('text-(--color-text-sub)');
  });

  it('has no current row in an abandoned game', () => {
    render(<TurnHistory state={{ ...midLeg, status: 'abandoned' }} />);
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.hasAttribute('aria-current'))).toBe(false);
  });

  it('scrolls the vertical table in its own reversed container', () => {
    render(<TurnHistory state={midLeg} />);
    const scroll = table().parentElement as HTMLElement;
    expect(scroll.className.split(' ')).toEqual(expect.arrayContaining(['flex', 'flex-col-reverse', 'overflow-y-auto']));
  });

  it('shows the place on the closing casual cell and out-of-queue cells after it', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      currentPlayerId: 'p2',
      players: [player('p1', 'Anna', { place: 1, remaining: 0 }), player('p2', 'Bartek'), player('p3', 'Celina')],
      legTurns: [legTurn('p1', { points: 140, remainingAfter: 0 }), legTurn('p2', { points: 60, remainingAfter: 441 }), legTurn('p3', { points: 45, remainingAfter: 456 })],
    });
    render(<TurnHistory state={state} />);
    const rows = within(table()).getAllByRole('row').slice(1);
    const closing = within(rows[0] as HTMLElement).getAllByRole('cell')[0] as HTMLElement;
    expect(within(closing).getByText('1. miejsce').className.split(' ')).toContain('sr-only');
    expect(closing.querySelector('svg')?.getAttribute('class')).toContain('text-(--color-gold)');
    expect(closing.textContent).toContain('0 (140)');
    const out = within(rows[1] as HTMLElement).getAllByRole('cell')[0] as HTMLElement;
    expect(within(out).getByText('poza kolejką').className.split(' ')).toContain('sr-only');
    expect(within(out).getByText('–').getAttribute('aria-hidden')).toBe('true');
  });

  it('lets the points drop under the score with four players in a narrow container', () => {
    const state = casual(['Anna', 'Bartek', 'Celina', 'Darek'], { legTurns: [legTurn('p1')], currentPlayerId: 'p2' });
    render(<TurnHistory state={state} />);
    expect(screen.getByText('(60)').className.split(' ')).toContain('@max-md:block');
  });

  it('shows Przebieg lega in Solo 501 with points and score rows', () => {
    render(<TurnHistory state={soloState()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Przebieg lega' })).toBeTruthy();
    const solo = screen.getByRole('table', { name: 'Przebieg lega' });
    const rowHeaders = within(solo).getAllByRole('rowheader');
    expect(rowHeaders.map((header) => [header.textContent, header.getAttribute('scope')])).toEqual([
      ['Punkty', 'row'],
      ['Zostało', 'row'],
    ]);
    const [points, remaining] = within(solo).getAllByRole('row').slice(1) as HTMLElement[];
    expect(within(points as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['60', 'Bust', '26', '…rzuca teraz']);
    expect(within(remaining as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['441', '441', '415', '']);
    expect(within(points as HTMLElement).getAllByRole('cell')[3]?.className.split(' ')).toContain('bg-(--color-surface-soft)');
  });

  it('scrolls the Solo 501 table sideways from the current turn', () => {
    render(<TurnHistory state={soloState()} />);
    const solo = screen.getByRole('table', { name: 'Przebieg lega' });
    expect(solo.className.split(' ')).toEqual(expect.arrayContaining(['w-max', 'min-w-full']));
    expect(solo.parentElement?.className.split(' ')).toEqual(expect.arrayContaining(['flex', 'flex-row-reverse', 'overflow-x-auto']));
  });

  it('has no current column in a finished Solo 501', () => {
    const state = soloState({ finished: true, status: 'finished', currentPlayerId: null });
    render(<TurnHistory state={state} />);
    const solo = screen.getByRole('table', { name: 'Przebieg lega' });
    expect(within(solo).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Tura', '1', '2', '3']);
  });

  it('shows Przebieg sesji in Free run with the dart labels and the open approach', () => {
    render(<TurnHistory state={freeRunState()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Przebieg sesji' })).toBeTruthy();
    const session = screen.getByRole('table', { name: 'Przebieg sesji' });
    expect(within(session).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Tura', 'Rzutki', 'Punkty']);
    const rows = within(session).getAllByRole('row').slice(1);
    expect(within(rows[0] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['T20 · 20 · 5', '85']);
    const current = rows[2] as HTMLElement;
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(within(current).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['20 · …rzuca teraz', '20']);
    expect(session.parentElement?.className.split(' ')).toEqual(expect.arrayContaining(['flex-col-reverse', 'overflow-y-auto']));
  });

  it('shows only the dots in the open Free run approach before its first dart', () => {
    render(<TurnHistory state={freeRunState({ currentDarts: [] })} />);
    const rows = within(screen.getByRole('table', { name: 'Przebieg sesji' })).getAllByRole('row').slice(1);
    expect(within(rows[2] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['…rzuca teraz', '']);
  });

  it('renders nothing in checkout practice', () => {
    const { container } = render(<TurnHistory state={checkoutPractice()} />);
    expect(container.innerHTML).toBe('');
  });
});
