import type { Hit, MatchSnapshot } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { CheckoutCard } from './CheckoutCard';

function onRemaining(remaining: number, overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    currentPlayerId: 'p1',
    players: [player('p1', 'Anna', { remaining, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    ...overrides,
  });
}

function renderCard(state: MatchSnapshot, disabled = false) {
  const onCheckout = vi.fn<(hit: Hit) => void>();
  const view = render(<CheckoutCard state={state} onCheckout={onCheckout} disabled={disabled} />);
  return { onCheckout, ...view };
}

const card = () => screen.getByRole<HTMLButtonElement>('button', { name: /Zamknięcie/ });

describe('CheckoutCard', () => {
  it('shows each dart of the route in its own chip', () => {
    renderCard(onRemaining(170));
    const chips = within(card()).getAllByText(/^(T20|Bull)$/);
    expect(chips.map((chip) => chip.textContent)).toEqual(['T20', 'T20', 'Bull']);
  });

  it.each([
    [40, 'Zamknięcie w 1 rzutce: D20. Kliknij albo Enter, aby wpisać D20'],
    [100, 'Zamknięcie w 2 rzutkach: T20, D20. Kliknij albo Enter, aby wpisać T20'],
    [170, 'Zamknięcie w 3 rzutkach: T20, T20, Bull. Kliknij albo Enter, aby wpisać T20'],
  ])('reads the route and the action on %i', (remaining, name) => {
    renderCard(onRemaining(remaining));
    expect(card().getAttribute('aria-label')).toBe(name);
  });

  it('is a button with the Enter shortcut and a badge', () => {
    renderCard(onRemaining(100));
    expect(card().getAttribute('type')).toBe('button');
    expect(card().getAttribute('aria-keyshortcuts')).toBe('Enter');
    const badge = within(card()).getByText('Enter');
    expect(badge.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows only the label, the chips and the badge', () => {
    renderCard(onRemaining(100));
    expect(card().textContent).toBe('ZamknięcieZamknięcie w 2 rzutkachT20D20Enter');
    expect(screen.queryByText(/do wygrania lega/)).toBeNull();
    expect(screen.queryByText(/aby wpisać/)).toBeNull();
  });

  it('sends the first dart on a click', () => {
    const { onCheckout } = renderCard(onRemaining(100));
    fireEvent.click(card());
    expect(onCheckout).toHaveBeenCalledExactlyOnceWith({ segment: 20, multiplier: 3 });
  });

  it('does nothing while disabled', () => {
    const { onCheckout } = renderCard(onRemaining(100), true);
    expect(card().disabled).toBe(true);
    fireEvent.click(card());
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it('keeps only a placeholder hidden from screen readers without a route', () => {
    renderCard(onRemaining(301));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Zamknięcie').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders nothing in Free run', () => {
    const state = snapshot({
      startingScore: null,
      currentPlayerId: 'p1',
      players: [player('p1', 'Anna', { remaining: null, legsWon: 0 })],
    });
    const { container } = renderCard(state);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing in a finished game', () => {
    const { container } = renderCard(onRemaining(40, { finished: true, currentPlayerId: null, winnerId: 'p2' }));
    expect(container.innerHTML).toBe('');
  });
});
