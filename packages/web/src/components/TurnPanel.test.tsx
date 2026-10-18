import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { player, snapshot } from '../test/snapshots';
import { TurnPanel } from './TurnPanel';

const onUndo = () => undefined;

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
    render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} />);
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
    render(<TurnPanel state={state} lastTurn={null} busy={false} onUndo={onUndo} />);
    expect(screen.queryByText(/rzuca/)).toBeNull();
    expect(screen.queryByText('czeka na rzutkę')).toBeNull();
  });
});
