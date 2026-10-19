import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { casual, player, snapshot } from '../test/snapshots';
import { Scoreboard } from './Scoreboard';

describe('Scoreboard', () => {
  it('shows legs in a 1v1 match', () => {
    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="large" />);
    expect(screen.getAllByText('Legi').length).toBeGreaterThan(0);
    expect(screen.getByText('Legi do 2')).toBeTruthy();
  });

  it('shows no legs in a casual game', () => {
    render(<Scoreboard state={casual(['Anna', 'Bartek', 'Celina'])} size="large" />);
    expect(screen.queryByText('Legi')).toBeNull();
  });

  it('shows a place badge for a finished casual player', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      currentPlayerId: 'p2',
      players: [player('p1', 'Anna', { place: 1, remaining: 0 }), player('p2', 'Bartek'), player('p3', 'Celina')],
    });
    render(<Scoreboard state={state} size="large" />);
    const row = screen.getByText('1. miejsce').closest('li');
    expect(row && within(row).getByText('Anna')).toBeTruthy();
  });

  it('marks the thrower row', () => {
    render(<Scoreboard state={snapshot({ currentPlayerId: 'p2' })} size="large" />);
    const row = screen.getByText('Rzuca').closest('li');
    expect(row?.getAttribute('aria-current')).toBe('true');
    expect(row && within(row).getByText('Bartek')).toBeTruthy();
    expect(screen.getAllByText('Rzuca')).toHaveLength(1);
  });

  it.each([
    ['casual with 2 players', casual(['Anna', 'Bartek']), 'large', 2],
    ['casual with 3 players', casual(['Anna', 'Bartek', 'Celina']), 'large', 1],
    ['a 1v1 match', snapshot(), 'large', 0],
    ['casual in compact', casual(['Anna', 'Bartek']), 'compact', 0],
  ] as const)('shows free player slots for %s', (_name, state, size, count) => {
    render(<Scoreboard state={state} size={size} />);
    const slots = screen.queryAllByText('Dodaj gracza');
    expect(slots).toHaveLength(count);
    for (const slot of slots) {
      expect((slot.closest('button') as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('marks only the next player in a rotating 1v1', () => {
    render(<Scoreboard state={snapshot({ currentPlayerId: 'p1' })} size="large" />);
    const next = screen.getByText('Następny').closest('li');
    expect(next && within(next).getByText('Bartek')).toBeTruthy();
    expect(next?.getAttribute('aria-current')).toBeNull();
    const thrower = screen.getByText('Rzuca').closest('li');
    expect(thrower && within(thrower).queryByText('Następny')).toBeNull();
    expect(screen.getAllByText('Następny')).toHaveLength(1);
  });

  it('names the free slots by player number', () => {
    render(<Scoreboard state={casual(['Anna', 'Bartek'])} size="large" />);
    for (const name of ['Dodaj gracza 3', 'Dodaj gracza 4']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('renders the names in compact size', () => {
    render(<Scoreboard state={snapshot()} size="compact" />);
    expect(screen.getByText('Anna')).toBeTruthy();
    expect(screen.getByText('Bartek')).toBeTruthy();
  });

  it('shows the session counter in Free run', () => {
    const state = snapshot({
      type: 'practice',
      practiceMode: 'free_run',
      startingScore: null,
      legsToWin: null,
      countsToStats: false,
      players: [player('p1', 'Anna', { remaining: null })],
      freeRun: { dartsThrown: 6, totalPoints: 245, average: 122.5 },
    });
    render(<Scoreboard state={state} size="large" />);
    expect(screen.getByText('245')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('122,5')).toBeTruthy();
  });

  it('stacks the row only from lg in a narrow container', () => {
    render(<Scoreboard state={snapshot()} size="large" />);
    const section = screen.getByRole('region', { name: 'Wyniki' });
    expect(section.className.split(' ')).toContain('@container');
    const card = screen.getByText('Anna').closest('li')?.firstElementChild;
    expect(card?.className.split(' ')).toEqual(expect.arrayContaining(['lg:@max-md:grid', 'lg:@max-md:content-center']));
  });

  it('moves the rows by a multiple of the CSS row height', () => {
    render(<Scoreboard state={casual(['Anna', 'Bartek', 'Celina'])} size="large" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[1]?.style.transform).toBe('translateY(calc(var(--row-height) * 1))');
    expect(rows[3]?.style.transform).toBe('translateY(calc(var(--row-height) * 3 + var(--slot-height) * 0))');
  });

  it('names the leg dots in a 1v1 match', () => {
    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="large" />);
    expect(screen.getByRole('img', { name: 'Legi: 1 z 2' }).children).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Legi: 0 z 2' })).toBeTruthy();
  });

  it('shows no leg dots in a casual game or in compact size', () => {
    const { unmount } = render(<Scoreboard state={casual(['Anna', 'Bartek', 'Celina'])} size="large" />);
    expect(screen.queryByRole('img')).toBeNull();
    unmount();

    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="compact" />);
    expect(screen.queryByRole('img')).toBeNull();
  });
});
