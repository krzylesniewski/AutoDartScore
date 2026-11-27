import type { Hit, MatchLegs } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { legProgress, legTurn, matchLeg, matchLegs, player, snapshot } from '../test/snapshots';
import { LegReview } from './LegReview';

const T = (segment: number): Hit => ({ segment, multiplier: 3 });
const D = (segment: number): Hit => ({ segment, multiplier: 2 });

// Leg 1 wygrywa Anna, leg 2 Bartek. Stan gry trzyma tury ostatniego lega.
const secondLegTurns = [
  legTurn('p2', { darts: [T(20), T(20), T(20)], points: 180, remainingAfter: 121 }),
  legTurn('p1', { darts: [T(19), T(19), T(19)], points: 171, remainingAfter: 130 }),
  legTurn('p2', { turnIndex: 1, darts: [T(20), T(17), D(5)], points: 121, remainingAfter: 0 }),
];
const finished = snapshot({
  id: 'm1',
  finished: true,
  status: 'finished',
  startingScore: 301,
  legIndex: 1,
  currentPlayerId: null,
  winnerId: 'p2',
  players: [player('p1', 'Anna', { remaining: 130, legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 1 })],
  legTurns: secondLegTurns,
});
const twoLegs: MatchLegs = matchLegs(
  [
    matchLeg({
      legIndex: 0,
      starterId: 'p1',
      winnerId: 'p1',
      checkout: 141,
      dartsThrown: 6,
      turns: [
        legTurn('p1', { darts: [T(20), T(20), D(20)], points: 160, remainingAfter: 141 }),
        legTurn('p2', { darts: [T(5), T(5), T(5)], points: 45, remainingAfter: 256 }),
        legTurn('p1', { turnIndex: 1, darts: [T(20), T(19), D(12)], points: 141, remainingAfter: 0 }),
      ],
    }),
    matchLeg({ legIndex: 1, starterId: 'p2', winnerId: 'p2', checkout: 121, dartsThrown: 6, turns: secondLegTurns }),
  ],
  { matchId: 'm1', finished: true, startingScore: 301 },
);

function tableRows(): string[] {
  const table = screen.getByRole('table', { name: 'Historia tur: wynik po turze i punkty w turze' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent ?? '');
}

describe('LegReview', () => {
  it('shows the chart from the summary and the turns from the game state without the leg history', () => {
    render(<LegReview state={finished} lastLegProgress={legProgress({ p1: [130], p2: [121, 0] }, { legIndex: 1 })} />);
    expect(screen.getByRole('img', { name: /^Zejście z wyniku w legu 2/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Historia tur · Leg 2' })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(tableRows()).toEqual(['1121 (180)130 (171)', '20 (121)']);
  });

  it('selects the last leg by default and lists a tab per leg', () => {
    render(<LegReview state={finished} lastLegProgress={null} legs={twoLegs} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Leg 1 Anna', 'Leg 2 Bartek']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(screen.getByRole('img', { name: /^Zejście z wyniku w legu 2/ })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Historia tur · Leg 2' })).toBeTruthy();
  });

  it('switches both the chart and the turn table to the picked leg', () => {
    render(<LegReview state={finished} lastLegProgress={null} legs={twoLegs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Leg 1 Anna' }));
    expect(screen.getByRole('img', { name: /^Zejście z wyniku w legu 1/ })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /^Zejście z wyniku w legu 2/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Historia tur · Leg 1' })).toBeTruthy();
    expect(tableRows()).toEqual(['1141 (160)256 (45)', '20 (141)']);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(screen.getByRole('tab', { name: 'Leg 1 Anna' }).id);
  });

  it('moves between legs with the arrow keys', () => {
    render(<LegReview state={finished} lastLegProgress={null} legs={twoLegs} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Leg 2 Bartek' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Leg 1 Anna' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Leg 1 Anna' }));
  });

  it('shows no tabs for a match with one leg', () => {
    const oneLeg = { ...twoLegs, legs: twoLegs.legs.slice(1) };
    render(<LegReview state={finished} lastLegProgress={null} legs={oneLeg} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.getByRole('img', { name: /^Zejście z wyniku w legu 2/ })).toBeTruthy();
  });

  it('shows nothing without a chart and without turns', () => {
    const { container } = render(<LegReview state={{ ...finished, legTurns: [] }} lastLegProgress={null} />);
    expect(container.textContent).toBe('');
  });
});
