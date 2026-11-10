import '../theme.css';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { casual, checkoutHistory, checkoutPractice, checkoutSession, player, snapshot } from '../test/snapshots';
import { Scoreboard } from './Scoreboard';

const THROWING = 'rzuca teraz · rzutka 1 z 3';

function rowsAbove(current: number, waiting: number, slot: number): string {
  return `calc(var(--row-current) * ${current} + var(--row-waiting) * ${waiting} + var(--row-placed) * 0 + var(--row-slot) * ${slot})`;
}

function freeRun() {
  return snapshot({
    type: 'practice',
    practiceMode: 'free_run',
    startingScore: null,
    legsToWin: null,
    countsToStats: false,
    players: [player('p1', 'Anna', { remaining: null })],
    freeRun: { dartsThrown: 6, totalPoints: 245, average: 122.5 },
  });
}

describe('Scoreboard', () => {
  it('shows legs in a 1v1 match', () => {
    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="large" />);
    expect(screen.getByText('Legi do 2')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Legi: 1 z 2' })).toBeTruthy();
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

  it("gives each avatar the player's own color, not the list position", () => {
    const state = snapshot({ players: [player('p1', 'Anna', { avatar: '🦊', color: 12 }), player('p2', 'Bartek', { avatar: '🎯', color: 7 })] });
    render(<Scoreboard state={state} size="large" />);
    expect(screen.getByText('🎯').classList).toContain('bg-(--color-avatar-7)');
    expect(screen.getByText('🦊').classList).toContain('bg-(--color-avatar-12)');
  });

  it('marks the thrower row', () => {
    render(<Scoreboard state={snapshot({ currentPlayerId: 'p2' })} size="large" />);
    const row = screen.getByText(THROWING).closest('li');
    expect(row?.getAttribute('aria-current')).toBe('true');
    expect(row && within(row).getByText('Bartek')).toBeTruthy();
    expect(screen.getAllByText(THROWING)).toHaveLength(1);
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
    const next = screen.getByText('następny').closest('li');
    expect(next && within(next).getByText('Bartek')).toBeTruthy();
    expect(next?.getAttribute('aria-current')).toBeNull();
    const thrower = screen.getByText(THROWING).closest('li');
    expect(thrower && within(thrower).queryByText('następny')).toBeNull();
    expect(screen.getAllByText('następny')).toHaveLength(1);
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

  it('shows the attempt counter in checkout practice', () => {
    const results = [true, true, false, true, false, true, false, true, false, true, true, false];
    render(<Scoreboard state={checkoutPractice(checkoutSession(checkoutHistory(results)))} size="large" />);
    const counter = within(screen.getByText('Anna').closest('li') ?? document.body);
    const terms = counter.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(terms).toEqual([
      ['Próby', '12'],
      ['Udane', '7'],
      ['Skuteczność', '58%'],
    ]);
  });

  it('shows no percent before the first checkout attempt', () => {
    render(<Scoreboard state={checkoutPractice()} size="large" />);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(values).toEqual(['0', '0', '—']);
  });

  it.each(['large', 'compact'] as const)('sets all four row heights on the list in %s size', (size) => {
    render(<Scoreboard state={snapshot()} size={size} />);
    const section = screen.getByRole('region', { name: 'Wyniki' });
    expect(section.className.split(' ')).toContain('@container');
    const list = within(section).getByRole('list');
    for (const name of ['--row-current', '--row-waiting', '--row-placed', '--row-slot']) {
      expect(list.className).toContain(`[${name}:`);
    }
  });

  it('moves the rows by the CSS heights of the rows above them', () => {
    render(<Scoreboard state={casual(['Anna', 'Bartek', 'Celina'])} size="large" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]?.style.transform).toBe(`translateY(${rowsAbove(0, 0, 0)})`);
    expect(rows[2]?.style.transform).toBe(`translateY(${rowsAbove(1, 1, 0)})`);
    expect(rows[3]?.style.transform).toBe(`translateY(${rowsAbove(1, 2, 0)})`);
    expect(rows[3]?.className.split(' ')).toContain('h-(--row-slot)');
    expect(screen.getByRole('list').style.height).toBe(rowsAbove(1, 2, 1));
  });

  it('names the leg dots in a 1v1 match', () => {
    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="large" />);
    expect(screen.getByRole('img', { name: 'Legi: 1 z 2' }).children).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Legi: 0 z 2' })).toBeTruthy();
  });

  it('shows no leg dots in a casual game but shows them in a 1v1 in compact size', () => {
    const { unmount } = render(<Scoreboard state={casual(['Anna', 'Bartek', 'Celina'])} size="large" />);
    expect(screen.queryByRole('img', { name: /^Legi:/ })).toBeNull();
    unmount();

    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="compact" />);
    expect(screen.getByRole('img', { name: 'Legi: 1 z 2' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Legi: 0 z 2' })).toBeTruthy();
  });

  it('gives each player in a 1v1 a progress bar', () => {
    const { unmount } = render(<Scoreboard state={snapshot()} size="large" />);
    expect(screen.getAllByRole('img', { name: 'Zostało 501 z 501 punktów' })).toHaveLength(2);
    unmount();

    const players = [player('p1', 'Anna', { remaining: 170, legsWon: 0 }), player('p2', 'Bartek', { remaining: 301, legsWon: 0 })];
    render(<Scoreboard state={snapshot({ startingScore: 301, players })} size="large" />);
    expect(screen.getByRole('img', { name: 'Zostało 170 z 301 punktów' })).toBeTruthy();
  });

  it('marks only the thrower bar as current', () => {
    const players = [player('p1', 'Anna', { remaining: 400, legsWon: 0 }), player('p2', 'Bartek', { remaining: 300, legsWon: 0 })];
    render(<Scoreboard state={snapshot({ currentPlayerId: 'p2', players })} size="large" />);
    expect(screen.getByRole('img', { name: 'Zostało 300 z 501 punktów' }).className.split(' ')).toContain('sc-progress--current');
    expect(screen.getByRole('img', { name: 'Zostało 400 z 501 punktów' }).className.split(' ')).not.toContain('sc-progress--current');
  });

  it('shows no progress bar in Free run', () => {
    render(<Scoreboard state={freeRun()} size="large" />);
    expect(screen.queryByRole('img', { name: /^Zostało/ })).toBeNull();
  });

  it('shows no progress bar in checkout practice', () => {
    render(<Scoreboard state={checkoutPractice()} size="large" />);
    expect(screen.queryByRole('img', { name: /^Zostało/ })).toBeNull();
  });

  it('shows no progress bar for a finished casual player', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      currentPlayerId: 'p2',
      players: [player('p1', 'Anna', { place: 1, remaining: 0 }), player('p2', 'Bartek'), player('p3', 'Celina')],
    });
    render(<Scoreboard state={state} size="large" />);
    const placed = screen.getByText('1. miejsce').closest('li');
    expect(placed && within(placed).queryByRole('img')).toBeNull();
    expect(screen.getAllByRole('img', { name: /^Zostało/ })).toHaveLength(2);
  });

  it('counts the darts of the open turn for the thrower', () => {
    render(<Scoreboard state={snapshot({ currentDarts: [{ segment: 20, multiplier: 1 }] })} size="large" />);
    const row = screen.getByText('rzuca teraz · rzutka 2 z 3').closest('li');
    expect(row?.getAttribute('aria-current')).toBe('true');
  });

  it('shows the thrower without a dart count in checkout practice', () => {
    render(<Scoreboard state={checkoutPractice()} size="large" />);
    const row = screen.getByText('rzuca teraz').closest('li');
    expect(row?.getAttribute('aria-current')).toBe('true');
    expect(screen.queryByText(/rzutka/)).toBeNull();
  });

  it('hides the card rings from screen readers', () => {
    const { container } = render(<Scoreboard state={snapshot()} size="large" />);
    const rings = container.querySelectorAll('svg.sc-card-rings');
    expect(rings.length).toBeGreaterThan(0);
    for (const svg of rings) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it("rings the thrower avatar in the player's color", () => {
    const state = snapshot({ currentPlayerId: 'p2', players: [player('p1', 'Anna', { avatar: '🦊', color: 12 }), player('p2', 'Bartek', { avatar: '🎯', color: 7 })] });
    render(<Scoreboard state={state} size="large" />);
    const thrower = screen.getByText('🎯');
    expect(thrower.classList).toContain('sc-avatar--current');
    expect(thrower.style.getPropertyValue('--sc-avatar-color')).toBe('var(--color-avatar-7)');
    expect(screen.getByText('🦊').classList).not.toContain('sc-avatar--current');
  });
});
