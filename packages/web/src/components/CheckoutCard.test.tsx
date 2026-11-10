import type { Hit, MatchSnapshot } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { CheckoutCard, ROUTE_CHIP } from './CheckoutCard';

function onRemaining(remaining: number, overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return snapshot({
    currentPlayerId: 'p1',
    players: [player('p1', 'Anna', { remaining, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
    ...overrides,
  });
}

function classes(element: Element): string[] {
  return element.className.split(' ').filter(Boolean);
}

function renderCard(state: MatchSnapshot, disabled = false) {
  const onCheckout = vi.fn<(hit: Hit) => void>();
  const view = render(<CheckoutCard state={state} onCheckout={onCheckout} disabled={disabled} />);
  return { onCheckout, ...view };
}

const card = () => screen.getByRole('button', { name: /Zamknięcie/ }) as HTMLButtonElement;

describe('CheckoutCard', () => {
  it('shows each dart of the route in its own chip', () => {
    renderCard(onRemaining(170));
    const chips = within(card()).getAllByText(/^(T20|Bull)$/);
    expect(chips.map((chip) => chip.textContent)).toEqual(['T20', 'T20', 'Bull']);
    for (const chip of chips) {
      expect(chip.className).toBe(ROUTE_CHIP);
    }
    expect(classes(chips[0]?.parentElement as HTMLElement)).toEqual(expect.arrayContaining(['flex', 'flex-nowrap', 'gap-(--space-4)']));
  });

  it('shows the short label below xl and the label with the dart count from xl', () => {
    renderCard(onRemaining(170));
    expect(classes(within(card()).getByText('Zamknięcie'))).toContain('xl:hidden');
    expect(classes(within(card()).getByText('Zamknięcie w 3 rzutkach'))).toEqual(expect.arrayContaining(['hidden', 'xl:inline']));
  });

  it.each([
    [40, 'Zamknięcie w 1 rzutce: D20. Kliknij albo Enter, aby wpisać D20'],
    [100, 'Zamknięcie w 2 rzutkach: T20, D20. Kliknij albo Enter, aby wpisać T20'],
    [170, 'Zamknięcie w 3 rzutkach: T20, T20, Bull. Kliknij albo Enter, aby wpisać T20'],
  ])('reads the route and the action on %i', (remaining, name) => {
    renderCard(onRemaining(remaining));
    expect(card().getAttribute('aria-label')).toBe(name);
  });

  it('is a button with the Enter shortcut and a badge from lg', () => {
    renderCard(onRemaining(100));
    expect(card().getAttribute('type')).toBe('button');
    expect(card().getAttribute('aria-keyshortcuts')).toBe('Enter');
    const badge = within(card()).getByText('Enter');
    expect(badge.getAttribute('aria-hidden')).toBe('true');
    expect(classes(badge)).toEqual(expect.arrayContaining(['sc-kbd--on-accent', 'hidden', 'lg:block']));
  });

  it('shows only the label, the chips and the badge', () => {
    renderCard(onRemaining(100));
    expect(card().textContent).toBe('ZamknięcieZamknięcie w 2 rzutkachT20D20Enter');
    expect(screen.queryByText(/do wygrania lega/)).toBeNull();
    expect(screen.queryByText(/aby wpisać/)).toBeNull();
  });

  it('has the Scena look', () => {
    renderCard(onRemaining(100));
    expect(classes(card())).toEqual(expect.arrayContaining(['sc-checkout', '@container']));
    const rings = card().querySelector('svg');
    expect(rings?.getAttribute('class')?.split(' ')).toEqual(expect.arrayContaining(['text-(--color-on-accent)', 'opacity-(--opacity-checkout-rings)']));
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

  it('keeps an invisible placeholder of the same height without a route', () => {
    const { container } = renderCard(onRemaining(301));
    const placeholder = container.firstElementChild as HTMLElement;
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(classes(placeholder)).toEqual(expect.arrayContaining(['invisible', 'max-lg:hidden']));
    expect(screen.queryByRole('button')).toBeNull();
    const placeholderChip = placeholder.querySelector('span span') as HTMLElement;
    expect(placeholderChip.className).toBe(ROUTE_CHIP);
    container.remove();

    renderCard(onRemaining(100));
    const sizing = (element: Element) => classes(element).filter((name) => /(^|:)(p[xy]?|h|min-h|gap|flex|flex-col|flex-row|items-\w+)(-|$)/.test(name));
    expect(sizing(placeholder)).toEqual(sizing(card()));
    expect(sizing(card())).toEqual(expect.arrayContaining(['lg:py-[18px]', 'lg:flex-col', 'gap-(--space-4)']));
  });

  it('renders nothing in Free run', () => {
    const state = snapshot({ startingScore: null, currentPlayerId: 'p1', players: [player('p1', 'Anna', { remaining: null, legsWon: 0 })] });
    const { container } = renderCard(state);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing in a finished game', () => {
    const { container } = renderCard(onRemaining(40, { finished: true, currentPlayerId: null, winnerId: 'p2' }));
    expect(container.innerHTML).toBe('');
  });

  it('uses the dark route chip at least as large as before', () => {
    const chip = ROUTE_CHIP.split(' ');
    expect(chip).toEqual(expect.arrayContaining(['bg-(--color-route-chip)', 'rounded-(--radius-chip)', 'text-(--color-on-accent)', 'leading-none', 'whitespace-nowrap', 'font-display']));
    const size = chip.find((name) => name.startsWith('text-[clamp('));
    const max = Number(/,(\d+)px\)\]$/.exec(size ?? '')?.[1]);
    expect(max).toBeGreaterThanOrEqual(52);
    expect(size).toBe('text-[clamp(33px,9.5cqi,52px)]');
  });
});
