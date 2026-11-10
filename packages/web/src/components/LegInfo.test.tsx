import type { MatchSnapshot } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkoutPractice, legTurn, player, snapshot } from '../test/snapshots';
import { LegInfo } from './LegInfo';

const T20 = { segment: 20, multiplier: 3 } as const;

const midLeg = snapshot({
  currentPlayerId: 'p1',
  currentDarts: [T20],
  legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 }), legTurn('p2', { points: 100, remainingAfter: 401 }), legTurn('p1', { bust: true, darts: [T20, T20], remainingAfter: 441 })],
});

function tile(label: string): HTMLElement {
  return screen.getByText(label).closest('dl') as HTMLElement;
}

function solo(): MatchSnapshot {
  return snapshot({
    type: 'practice',
    practiceMode: 'solo_501',
    legsToWin: null,
    players: [player('p1', 'Anna', { remaining: 441 })],
    legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 })],
  });
}

describe('LegInfo', () => {
  it('is a flat panel with the id the Tury button points to', () => {
    const { container } = render(<LegInfo state={midLeg} id="leg-info" />);
    const section = container.firstElementChild as HTMLElement;
    expect(section.tagName).toBe('SECTION');
    expect(section.id).toBe('leg-info');
    expect(section.className.split(' ')).toEqual(expect.arrayContaining(['sc-panel', 'sc-panel--flat']));
  });

  it('shows the highest turn with the player name when two or more play', () => {
    render(<LegInfo state={midLeg} id="leg-info" />);
    expect(within(tile('Najwyższa tura')).getByRole('definition').textContent).toBe('100Bartek');
  });

  it('shows the highest turn without a name in Solo 501', () => {
    render(<LegInfo state={solo()} id="leg-info" />);
    expect(within(tile('Najwyższa tura')).getByRole('definition').textContent).toBe('60');
  });

  it('shows a dash for the highest turn before any scoring turn', () => {
    render(<LegInfo state={snapshot()} id="leg-info" />);
    expect(within(tile('Najwyższa tura')).getByRole('definition').textContent).toBe('—');
  });

  it('counts the darts of the leg with the open turn and the busts with the icon', () => {
    render(<LegInfo state={midLeg} id="leg-info" />);
    expect(within(tile('Rzutek w legu')).getByRole('definition').textContent).toBe('9');
    const busts = within(tile('Busty')).getByRole('definition');
    expect(busts.textContent).toBe('1');
    expect(busts.querySelector('svg')).toBeTruthy();
  });

  it('puts the tiles above the table below lg and under it from lg', () => {
    render(<LegInfo state={midLeg} id="leg-info" />);
    const tiles = tile('Busty').parentElement?.parentElement as HTMLElement;
    expect(tiles.className.split(' ')).toContain('lg:order-last');
    const table = screen.getByRole('table', { name: 'Historia tur: wynik po turze i punkty w turze' });
    expect(tiles.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no tiles in Free run', () => {
    const state = snapshot({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      players: [player('p1', 'Anna', { remaining: null })],
      legTurns: [legTurn('p1', { points: 85, remainingAfter: null })],
    });
    render(<LegInfo state={state} id="leg-info" />);
    expect(screen.getByRole('heading', { name: 'Przebieg sesji' })).toBeTruthy();
    expect(screen.queryByText('Najwyższa tura')).toBeNull();
    expect(screen.queryByText('Rzutek w legu')).toBeNull();
    expect(screen.queryByText('Busty')).toBeNull();
  });

  it('renders nothing in checkout practice', () => {
    const { container } = render(<LegInfo state={checkoutPractice()} id="leg-info" />);
    expect(container.innerHTML).toBe('');
  });

  it('has a close button only below lg when it can be closed', () => {
    const onClose = vi.fn();
    render(<LegInfo state={midLeg} id="leg-info" onClose={onClose} />);
    const close = screen.getByRole('button', { name: 'Zamknij historię tur' });
    expect(close.className.split(' ')).toEqual(expect.arrayContaining(['sc-btn--icon', 'lg:hidden']));
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has no close button without onClose', () => {
    render(<LegInfo state={midLeg} id="leg-info" />);
    expect(screen.queryByRole('button', { name: 'Zamknij historię tur' })).toBeNull();
  });
});
