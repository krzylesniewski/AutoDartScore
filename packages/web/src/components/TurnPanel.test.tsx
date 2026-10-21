import type { Hit } from '@autoscore/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { TurnPanel } from './TurnPanel';

const onUndo = () => undefined;
const onCheckout = () => undefined;

describe('TurnPanel', () => {
  it('shows the thrower, the darts with points and the checkout', () => {
    const state = snapshot({
      currentPlayerId: 'p1',
      currentDarts: [
        { segment: 20, multiplier: 3 },
        { segment: 19, multiplier: 3 },
      ],
      players: [player('p1', 'Anna', { remaining: 24, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    });
    render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(screen.getByText('Anna rzuca')).toBeTruthy();
    expect(screen.getByText('Rzutka 3 z 3')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('57')).toBeTruthy();
    expect(screen.getByText('60 + 57')).toBeTruthy();
    expect(screen.getByText('117')).toBeTruthy();
    expect(screen.getAllByText('czeka na rzutkę')).toHaveLength(1);
    expect(screen.getByLabelText('Rzutka 3').textContent).toContain('czeka na rzutkę');
    expect(screen.getByText('D12')).toBeTruthy();
    expect(screen.getByText('1 rzutka do wygrania lega')).toBeTruthy();
  });

  it('shows no heading and no waiting slot once the match is over', () => {
    const state = snapshot({
      finished: true,
      currentPlayerId: null,
      winnerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 0, legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })],
    });
    render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(screen.queryByText(/rzuca/)).toBeNull();
    expect(screen.queryByText('czeka na rzutkę')).toBeNull();
  });

  it('keeps an invisible checkout placeholder without a route', () => {
    const state = snapshot({ currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 301, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] });
    const { container } = render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(container.querySelector('[aria-hidden="true"].invisible.max-lg\\:hidden')).not.toBeNull();
    expect(screen.queryByText('Zamknięcie')).toBeNull();
    expect(screen.queryByText(/do wygrania lega/)).toBeNull();
  });

  it('has no checkout placeholder in Free run', () => {
    const state = snapshot({ startingScore: null, currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: null, legsWon: 0 })] });
    const { container } = render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    expect(container.querySelector('.invisible')).toBeNull();
  });

  it('keeps an empty name line without a closed turn', () => {
    const state = snapshot({ currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 301, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] });
    const { container } = render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
    const line = container.querySelector('p[aria-hidden="true"]');
    expect(line?.className.split(' ')).toContain('max-lg:hidden');
    expect(line?.textContent).toBe('\u00a0');
  });

  describe('checkout entry', () => {
    const state = snapshot({
      currentPlayerId: 'p1',
      currentDarts: [{ segment: 20, multiplier: 1 }],
      players: [player('p1', 'Anna', { remaining: 100, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    });

    function renderPanel(checkoutDisabled = false) {
      const onCheckoutHit = vi.fn<(hit: Hit) => void>();
      render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckoutHit} checkoutDisabled={checkoutDisabled} />);
      const card = screen.getByRole('button', { name: /Zamknięcie/ }) as HTMLButtonElement;
      return { onCheckoutHit, card };
    }

    it('renders the route as a button with the hint for the first dart', () => {
      const { card } = renderPanel();
      expect(card.getAttribute('type')).toBe('button');
      expect(card.getAttribute('aria-keyshortcuts')).toBe('Enter');
      expect(card.textContent).toContain('T20 D20');
      expect(screen.getByText('Kliknij albo Enter, aby wpisać T20').className.split(' ')).toContain('pointer-coarse:hidden');
      expect(screen.getByText('Dotknij, aby wpisać T20').className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'pointer-coarse:inline']));
    });

    it('keeps the hint on one truncated line', () => {
      renderPanel();
      const line = screen.getByText('Kliknij albo Enter, aby wpisać T20').parentElement as HTMLElement;
      expect(line.className.split(' ')).toEqual(expect.arrayContaining(['truncate', 'text-sm', 'leading-tight']));
    });

    it('calls onCheckout with the first dart on a click', () => {
      const { card, onCheckoutHit } = renderPanel();
      fireEvent.click(card);
      expect(onCheckoutHit).toHaveBeenCalledExactlyOnceWith({ segment: 20, multiplier: 3 });
    });

    it('is disabled with checkoutDisabled', () => {
      const { card, onCheckoutHit } = renderPanel(true);
      expect(card.disabled).toBe(true);
      fireEvent.click(card);
      expect(onCheckoutHit).not.toHaveBeenCalled();
    });

    it('keeps the card 80 px high from lg', () => {
      const { card } = renderPanel();
      expect(card.className.split(' ')).toContain('lg:h-20');
    });

    it('keeps the placeholder without a route out of the buttons', () => {
      const noRoute = snapshot({ currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: 301, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] });
      const { container } = render(<TurnPanel state={noRoute} lastTurn={null} busy={false} onUndo={onUndo} onCheckout={onCheckout} checkoutDisabled={false} />);
      const placeholder = container.querySelector('[aria-hidden="true"].invisible');
      expect(placeholder?.tagName).toBe('DIV');
      expect(placeholder?.className.split(' ')).toContain('lg:h-20');
      expect(screen.queryByRole('button', { name: /Zamknięcie/ })).toBeNull();
      expect(screen.queryByText(/aby wpisać/)).toBeNull();
    });

    it('gives Cofnij a Backspace badge without changing its name', () => {
      renderPanel();
      const undo = screen.getByRole('button', { name: 'Cofnij' });
      expect(undo.getAttribute('aria-keyshortcuts')).toBe('Backspace');
      expect(undo.className.split(' ')).toContain('relative');
      const badge = undo.querySelector('span[aria-hidden="true"]');
      expect(badge?.textContent).toBe('Backspace');
      expect(badge?.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'hidden', 'lg:block']));
    });
  });
});
