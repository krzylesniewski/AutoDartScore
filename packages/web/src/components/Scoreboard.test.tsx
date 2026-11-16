import '../theme.css';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { casual, checkoutHistory, checkoutPractice, checkoutSession, legTurn, player, snapshot } from '../test/snapshots';
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
    // Stały kolor awatara gracza widać tylko w klasie tokenu. Anna stoi pierwsza, ale ma kolor 12.
    expect(screen.getByText('🦊').className).toContain('bg-(--color-avatar-12)');
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

  it('puts Suma last in the Free run counter', () => {
    render(<Scoreboard state={freeRun()} size="large" />);
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(['Rzutki', 'Średnia', 'Suma']);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual(['6', '122,5', '245']);
  });

  it('shows the attempt counter in checkout practice', () => {
    const results = [true, true, false, true, false, true, false, true, false, true, true, false];
    render(<Scoreboard state={checkoutPractice(checkoutSession(checkoutHistory(results)))} size="large" />);
    const counter = within(screen.getByText('Anna').closest('li') ?? document.body);
    const values = counter.getAllByRole('definition');
    const terms = counter.getAllByRole('term').map((term, index) => [term.textContent, values[index]?.textContent]);
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

  it('moves the rows by the CSS heights of the rows above them', () => {
    render(<Scoreboard state={casual(['Anna', 'Bartek', 'Celina'])} size="large" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]?.style.transform).toBe(`translateY(${rowsAbove(0, 0, 0)})`);
    expect(rows[2]?.style.transform).toBe(`translateY(${rowsAbove(1, 1, 0)})`);
    expect(rows[3]?.style.transform).toBe(`translateY(${rowsAbove(1, 2, 0)})`);
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

  it('puts the thrower bar in the thrower row', () => {
    const players = [player('p1', 'Anna', { remaining: 400, legsWon: 0 }), player('p2', 'Bartek', { remaining: 300, legsWon: 0 })];
    render(<Scoreboard state={snapshot({ currentPlayerId: 'p2', players })} size="large" />);
    const thrower = screen.getByText(THROWING).closest('li') as HTMLElement;
    expect(thrower.getAttribute('aria-current')).toBe('true');
    expect(within(thrower).getByRole('img', { name: 'Zostało 300 z 501 punktów' })).toBeTruthy();
    expect(within(thrower).queryByRole('img', { name: 'Zostało 400 z 501 punktów' })).toBeNull();
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

  it('shows the thrower score in the thrower row', () => {
    render(<Scoreboard state={snapshot({ players: [player('p1', 'Anna', { remaining: 321, legsWon: 0 }), player('p2', 'Bartek', { legsWon: 0 })] })} size="large" />);
    const thrower = screen.getByText(THROWING).closest('li') as HTMLElement;
    expect(within(thrower).getByText('321')).toBeTruthy();
  });

  it('hides every drawing from screen readers', () => {
    const { container } = render(<Scoreboard state={snapshot()} size="large" />);
    const drawings = container.querySelectorAll('svg');
    expect(drawings.length).toBeGreaterThan(0);
    for (const svg of drawings) {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("rings the thrower avatar in the player's color", () => {
    const state = snapshot({ currentPlayerId: 'p2', players: [player('p1', 'Anna', { avatar: '🦊', color: 12 }), player('p2', 'Bartek', { avatar: '🎯', color: 7 })] });
    render(<Scoreboard state={state} size="large" />);
    expect(screen.getByText('🎯').style.getPropertyValue('--sc-avatar-color')).toBe('var(--color-avatar-7)');
    expect(screen.getByText('🦊').style.getPropertyValue('--sc-avatar-color')).toBe('');
  });
});

describe('Scoreboard leg info', () => {
  // Anna rzuca trzecią turę: 60 i 71 zbite. Bartek ma za sobą jedną turę.
  function midLeg(bartekLast = legTurn('p2', { points: 60, remainingAfter: 441 })) {
    return snapshot({
      currentPlayerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 370, legsWon: 0 }), player('p2', 'Bartek', { remaining: bartekLast.remainingAfter ?? 501, legsWon: 0 })],
      legTurns: [legTurn('p1', { points: 60, remainingAfter: 441 }), bartekLast, legTurn('p1', { points: 71, remainingAfter: 370 })],
    });
  }

  function row(name: string): HTMLElement {
    return screen.getByText(name).closest('li') as HTMLElement;
  }

  it('shows the points knocked off on the thrower card with a screen reader text', () => {
    render(<Scoreboard state={midLeg()} size="large" />);
    const visible = within(row('Anna')).getByText('▼ 131 w 2 turach');
    expect(visible.getAttribute('aria-hidden')).toBe('true');
    expect(within(row('Anna')).getByText('Zbite 131 punktów w 2 turach').getAttribute('aria-hidden')).toBeNull();
  });

  it("shows the last turn of a waiting player after the next player's label", () => {
    render(<Scoreboard state={midLeg()} size="large" />);
    const bartek = row('Bartek');
    expect(within(bartek).getByText('następny')).toBeTruthy();
    expect(within(bartek).getByText('▼ 60').getAttribute('aria-hidden')).toBe('true');
    expect(within(bartek).getByText('Ostatnia tura: 60 punktów').getAttribute('aria-hidden')).toBeNull();
  });

  it('shows the last turn alone for a waiting player who is not next', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      currentPlayerId: 'p1',
      legTurns: [legTurn('p1'), legTurn('p2', { points: 45, remainingAfter: 456 }), legTurn('p3', { points: 26, remainingAfter: 475 })],
    });
    render(<Scoreboard state={state} size="large" />);
    const celina = row('Celina');
    expect(within(celina).queryByText('następny')).toBeNull();
    expect(within(celina).getByText('▼ 26')).toBeTruthy();
  });

  it('shows the bust icon and Bust after a bust, read as the last turn bust', () => {
    render(<Scoreboard state={midLeg(legTurn('p2', { bust: true, remainingAfter: 501 }))} size="large" />);
    const bartek = row('Bartek');
    const bust = within(bartek).getByText('Bust');
    expect(bust.getAttribute('aria-hidden')).toBe('true');
    expect(bust.querySelector('svg')).toBeTruthy();
    expect(within(bartek).getByText('Ostatnia tura: bust').getAttribute('aria-hidden')).toBeNull();
    expect(within(bartek).queryByText(/^▼/)).toBeNull();
  });

  it('shows nothing before the first closed turn', () => {
    render(<Scoreboard state={snapshot({ currentDarts: [{ segment: 20, multiplier: 3 }] })} size="large" />);
    expect(screen.queryByText(/▼/)).toBeNull();
    expect(screen.queryByText(/^Zbite/)).toBeNull();
    expect(screen.queryByText(/^Ostatnia tura/)).toBeNull();
  });

  it('shows nothing in Free run', () => {
    const state = { ...freeRun(), legTurns: [legTurn('p1', { points: 85, remainingAfter: null })] };
    render(<Scoreboard state={state} size="large" />);
    expect(screen.queryByText(/▼/)).toBeNull();
    expect(screen.queryByText(/^Zbite/)).toBeNull();
  });

  it('shows nothing in checkout practice', () => {
    render(<Scoreboard state={checkoutPractice(checkoutSession(checkoutHistory([true])))} size="large" />);
    expect(screen.queryByText(/▼/)).toBeNull();
    expect(screen.queryByText(/^Zbite/)).toBeNull();
  });

  it('shows none of it in the compact size', () => {
    render(<Scoreboard state={midLeg()} size="compact" />);
    expect(screen.queryByText(/▼/)).toBeNull();
    expect(screen.queryByText(/^Zbite/)).toBeNull();
    expect(screen.queryByText(/^Ostatnia tura/)).toBeNull();
  });
});
