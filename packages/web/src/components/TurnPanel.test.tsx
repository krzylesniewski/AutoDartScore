import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LastTurn } from '../api/use-match';
import { player, snapshot } from '../test/snapshots';
import { TurnPanel } from './TurnPanel';

const twoDarts = snapshot({
  currentPlayerId: 'p1',
  currentDarts: [
    { segment: 20, multiplier: 3 },
    { segment: 19, multiplier: 3 },
  ],
  players: [player('p1', 'Anna', { remaining: 24, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })],
});

function classes(element: Element): string[] {
  return element.className.split(' ').filter(Boolean);
}

function panel(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement;
}

describe('TurnPanel', () => {
  it('shows each dart with its points and the turn total', () => {
    render(<TurnPanel state={twoDarts} lastTurn={null} />);
    expect(within(screen.getByLabelText('Rzutka 1')).getByText('T20')).toBeTruthy();
    expect(within(screen.getByLabelText('Rzutka 1')).getByText('60')).toBeTruthy();
    expect(within(screen.getByLabelText('Rzutka 2')).getByText('T19')).toBeTruthy();
    expect(within(screen.getByLabelText('Rzutka 2')).getByText('57')).toBeTruthy();
    expect(screen.getByText('w tej turze')).toBeTruthy();
    expect(screen.getByText('117')).toBeTruthy();
    expect(screen.queryByText('60 + 57')).toBeNull();
  });

  it('marks exactly one slot as waiting for the next dart', () => {
    render(<TurnPanel state={twoDarts} lastTurn={null} />);
    expect(screen.getAllByText('czeka na rzutkę')).toHaveLength(1);
    const waiting = screen.getByLabelText('Rzutka 3');
    expect(waiting.textContent).toBe('czeka na rzutkę');
    expect(classes(waiting)).toEqual(expect.arrayContaining(['sc-slot', 'sc-slot--active']));
    expect(waiting.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(classes(screen.getByLabelText('Rzutka 1'))).toEqual(expect.arrayContaining(['sc-slot', 'sc-slot--filled']));
  });

  it('labels the empty slots with their number', () => {
    render(<TurnPanel state={snapshot()} lastTurn={null} />);
    expect(screen.getByLabelText('Rzutka 1').textContent).toBe('czeka na rzutkę');
    for (const name of ['Rzutka 2', 'Rzutka 3']) {
      const slot = screen.getByLabelText(name);
      expect(slot.textContent).toBe(name);
      expect(classes(slot)).toContain('sc-slot');
      expect(classes(slot)).not.toContain('sc-slot--active');
      expect(classes(slot)).not.toContain('sc-slot--filled');
    }
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows no waiting slot once the game is over', () => {
    const state = snapshot({
      finished: true,
      currentPlayerId: null,
      winnerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 0, legsWon: 2 }), player('p2', 'Bartek', { legsWon: 1 })],
    });
    render(<TurnPanel state={state} lastTurn={null} />);
    expect(screen.queryByText('czeka na rzutkę')).toBeNull();
    expect(screen.queryByText(/rzuca/)).toBeNull();
  });

  it('shows Bust with its icon instead of the total', () => {
    const state = snapshot({ eventSeq: 7, currentPlayerId: 'p2' });
    const lastTurn: LastTurn = { playerId: 'p1', darts: [{ segment: 20, multiplier: 3 }], total: null, bust: true, eventSeq: 7 };
    render(<TurnPanel state={state} lastTurn={lastTurn} />);
    const bust = screen.getByText('Bust');
    expect(bust.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(screen.getByLabelText('Rzutka 1')).getByText('T20')).toBeTruthy();
  });

  it('dims the closed turn and names its thrower in place of the total label', () => {
    const state = snapshot({ eventSeq: 4, currentPlayerId: 'p2' });
    const lastTurn: LastTurn = {
      playerId: 'p1',
      darts: [
        { segment: 20, multiplier: 1 },
        { segment: 5, multiplier: 1 },
        { segment: 1, multiplier: 1 },
      ],
      total: 26,
      bust: false,
      eventSeq: 4,
    };
    const { container } = render(<TurnPanel state={state} lastTurn={lastTurn} />);
    expect(classes(screen.getByRole('list'))).toContain('opacity-50');
    const name = screen.getByText('Anna');
    expect(classes(name)).toContain('truncate');
    expect(screen.queryByText('w tej turze')).toBeNull();
    expect(screen.getByText('26')).toBeTruthy();
    expect(screen.queryByText('czeka na rzutkę')).toBeNull();
    expect(classes(panel(container))).toEqual(expect.arrayContaining(['h-[60px]', 'lg:h-[120px]']));
  });

  it('keeps the same fixed height in every state', () => {
    const closed: LastTurn = { playerId: 'p1', darts: [], total: 0, bust: true, eventSeq: 0 };
    const states = [
      { state: snapshot(), lastTurn: null },
      { state: twoDarts, lastTurn: null },
      { state: snapshot(), lastTurn: closed },
      { state: snapshot({ finished: true, currentPlayerId: null, winnerId: 'p1' }), lastTurn: null },
    ];
    for (const { state, lastTurn } of states) {
      const { container, unmount } = render(<TurnPanel state={state} lastTurn={lastTurn} />);
      const root = classes(panel(container));
      expect(root).toEqual(expect.arrayContaining(['h-[60px]', 'lg:h-[120px]']));
      expect(root.filter((name) => /^(lg:)?(min-)?h-/.test(name))).toEqual(['h-[60px]', 'lg:h-[120px]']);
      unmount();
    }
  });

  it('has no button', () => {
    render(<TurnPanel state={twoDarts} lastTurn={null} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
