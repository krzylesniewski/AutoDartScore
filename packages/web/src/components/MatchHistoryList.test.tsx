import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listItem, player } from '../test/snapshots';
import { MatchHistoryList } from './MatchHistoryList';

const NOW = new Date('2026-10-18T12:00:00.000Z');

const finished = {
  status: 'finished' as const,
  currentPlayerId: null,
  winnerId: 'p1',
  players: [player('p1', 'Anna', { legsWon: 3 }), player('p2', 'Bartek', { legsWon: 1 })],
};

const tournamentMatch = listItem({
  id: 'm_cup',
  ...finished,
  tournament: { id: 't 1', name: 'Liga jesień', fixtureId: 'p-sf-2', label: 'Półfinał 2' },
});

const plainMatch = listItem({ id: 'm_plain', ...finished });

function item(id: string): HTMLElement {
  const link = screen.getAllByRole('link', { name: /^Szczegóły/ }).find((entry) => entry.getAttribute('href') === `#/matches/${id}`);
  const found = link?.closest('li');
  if (!found) {
    throw new Error(`no row for ${id}`);
  }
  return found;
}

describe('MatchHistoryList', () => {
  it('links a tournament match to its tournament under the result and type', () => {
    render(<MatchHistoryList games={[tournamentMatch, plainMatch]} now={NOW} />);
    const link = within(item('m_cup')).getByRole('link', { name: 'Liga jesień · Półfinał 2' });
    expect(link.getAttribute('href')).toBe('#/tournaments/t%201');
    expect(
      within(item('m_cup'))
        .getAllByRole('link')
        .map((entry) => entry.getAttribute('href')),
    ).toEqual(['#/tournaments/t%201', '#/matches/m_cup']);
  });

  it('has no tournament link for a plain match', () => {
    render(<MatchHistoryList games={[plainMatch]} now={NOW} />);
    expect(
      within(item('m_plain'))
        .getAllByRole('link')
        .map((entry) => entry.getAttribute('href')),
    ).toEqual(['#/matches/m_plain']);
    expect(screen.queryByRole('link', { name: /Liga jesień/ })).toBeNull();
  });

  it('keeps the tournament link with the abandon button and in day groups', () => {
    const running = { ...tournamentMatch, status: 'in_progress' as const, currentPlayerId: 'p1', winnerId: null };
    render(<MatchHistoryList games={[running]} now={NOW} onAbandon={() => undefined} groupByDay />);
    const row = item('m_cup');
    expect(within(row).getByRole('link', { name: 'Liga jesień · Półfinał 2' })).toBeTruthy();
    expect(within(row).getAllByRole('button')).toHaveLength(1);
  });
});
