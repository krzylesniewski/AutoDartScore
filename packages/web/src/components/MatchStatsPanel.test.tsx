import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { casual, snapshot, summary, summaryPlayer } from '../test/snapshots';
import { MatchStatsPanel } from './MatchStatsPanel';

const state = snapshot();

function panel(): HTMLElement {
  return screen.getByRole('table', { name: 'Statystyki meczu' });
}

describe('MatchStatsPanel', () => {
  it('shows both players with the five columns', () => {
    render(
      <MatchStatsPanel
        state={state}
        summary={summary({
          players: [
            summaryPlayer('p1', { dartsThrown: 6, average: 150.5, first9Average: 150.5, highestCheckout: 121, doubleAttempts: 1, doublesHit: 1, doublesPercent: 100, legsWon: 1 }),
            summaryPlayer('p2', { dartsThrown: 3, average: 0, first9Average: 0 }),
          ],
        })}
      />,
    );
    const table = within(panel());
    expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Średnia', 'First 9', 'Max zamk.', '% doubli', 'Legi']);
    const [anna, bartek] = table.getAllByRole('row').slice(1);
    expect(within(anna as HTMLElement).getByRole('rowheader').textContent).toBe('Anna');
    expect(within(anna as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['150.50', '150.50', '121', '100.0% (1/1)', '1']);
    expect(within(bartek as HTMLElement).getByRole('rowheader').textContent).toBe('Bartek');
    expect(within(bartek as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['0.00', '0.00', '—', '—', '0']);
  });

  it('shows dashes before the first summary arrives', () => {
    render(<MatchStatsPanel state={state} summary={null} />);
    expect(within(panel()).getAllByText('—')).toHaveLength(10);
  });

  it('shows the last leg line only after a leg', () => {
    const { rerender } = render(<MatchStatsPanel state={state} summary={summary()} />);
    expect(screen.queryByText(/Ostatni leg/)).toBeNull();
    rerender(
      <MatchStatsPanel
        state={state}
        summary={summary({
          legs: [
            { legIndex: 0, winnerId: 'p2', checkout: 40, dartsThrown: 22, averages: [] },
            { legIndex: 1, winnerId: 'p1', checkout: 121, dartsThrown: 9, averages: [] },
          ],
        })}
      />,
    );
    expect(screen.getByText('Ostatni leg: Anna · 9 rzutek · zamknięcie 121')).toBeTruthy();
  });

  it('renders nothing outside a 1v1 match', () => {
    const { container } = render(<MatchStatsPanel state={casual(['Anna', 'Bartek', 'Celina'])} summary={null} />);
    expect(container.innerHTML).toBe('');
  });
});
