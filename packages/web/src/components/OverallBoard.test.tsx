import type { OverallPlayer, StatsOverall } from '@autoscore/schema';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OverallBoard } from './OverallBoard';

function overallPlayer(playerId: string, name: string, darts: number, average: number | null, difference: number | null): OverallPlayer {
  return { playerId, name, avatar: null, color: 1, darts, legs: average === null ? 0 : 1, average, difference };
}

const overall: StatsOverall = {
  games: 4,
  legs: 7,
  darts: 1234,
  average: 60.5,
  players: [
    overallPlayer('p1', 'Anna', 600, 80.75, 20.25),
    overallPlayer('p2', 'Bartek', 300, 60.5, 0),
    overallPlayer('p3', 'Celina', 250, 50.25, -10.25),
    overallPlayer('p4', 'Darek', 60, 40.5, -20),
    overallPlayer('p5', 'Ewa', 22, null, null),
    overallPlayer('p6', 'Filip', 2, null, null),
  ],
};

function classes(element: Element | null | undefined): string[] {
  return element?.getAttribute('class')?.split(' ') ?? [];
}

function group(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

function names(container: HTMLElement): string[] {
  return within(container)
    .getAllByRole('link')
    .map((link) => within(link).getByText(/^[A-Z][a-z]+$/).textContent ?? '');
}

describe('OverallBoard', () => {
  it('shows four tiles with the totals', () => {
    render(<OverallBoard overall={overall} />);
    const tiles = screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(tiles).toEqual([
      ['Lotki łącznie', '1234'],
      ['Średnia ogólna (3 rzutki)', '60,50'],
      ['Gry', '4'],
      ['Legi', '7'],
    ]);
  });

  it('shows a dash for the overall average without completed legs', () => {
    render(<OverallBoard overall={{ ...overall, average: null, players: [overallPlayer('p5', 'Ewa', 22, null, null)] }} />);
    expect(screen.getByText('Średnia ogólna (3 rzutki)').nextElementSibling?.textContent).toBe('—');
    expect(screen.queryByRole('region', { name: 'Powyżej średniej' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Poniżej średniej' })).toBeNull();
    expect(names(group('Bez ukończonego lega'))).toEqual(['Ewa']);
  });

  it('groups players by the sign of the difference and keeps the server order', () => {
    render(<OverallBoard overall={overall} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Powyżej średniej', 'Poniżej średniej', 'Bez ukończonego lega']);
    expect(names(group('Powyżej średniej'))).toEqual(['Anna', 'Bartek']);
    expect(names(group('Poniżej średniej'))).toEqual(['Celina', 'Darek']);
    expect(names(group('Bez ukończonego lega'))).toEqual(['Ewa', 'Filip']);
  });

  it('marks the groups above and below with an arrow next to the heading text', () => {
    render(<OverallBoard overall={overall} />);
    for (const name of ['Powyżej średniej', 'Poniżej średniej']) {
      const heading = within(group(name)).getByRole('heading', { level: 2 });
      expect(heading.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    expect(within(group('Bez ukończonego lega')).getByRole('heading', { level: 2 }).querySelector('svg')).toBeNull();
  });

  it('shows the average, the signed difference and the darts in each row', () => {
    render(<OverallBoard overall={overall} />);
    expect(within(group('Powyżej średniej')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['AAnna80,75+20,25600 lotek', 'BBartek60,50+0,00300 lotek']);
    expect(within(group('Poniżej średniej')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['CCelina50,25−10,25250 lotek', 'DDarek40,50−20,0060 lotek']);
    expect(within(group('Bez ukończonego lega')).getAllByRole('listitem').map((row) => row.textContent)).toEqual(['EEwa—22 lotki', 'FFilip—2 lotki']);
  });

  it('links each row to the player card', () => {
    render(<OverallBoard overall={{ ...overall, players: [overallPlayer('a b', 'Anna', 6, 75.25, 0)] }} />);
    expect(screen.getByRole('link', { name: /Anna/ }).getAttribute('href')).toBe('#/stats/a%20b');
  });

  it('adapts the layout to phones, tablets and a monitor', () => {
    render(<OverallBoard overall={overall} />);
    const tiles = classes(document.querySelector('dl'));
    expect(tiles).toEqual(expect.arrayContaining(['grid-cols-2', 'lg:grid-cols-4']));
    const list = group('Powyżej średniej').parentElement;
    expect(classes(list)).toEqual(expect.arrayContaining(['@container', 'xl:min-h-0', 'xl:flex-1', 'xl:overflow-y-auto']));
    expect(classes(list)).not.toContain('overflow-y-auto');
    expect(classes(list?.parentElement)).toEqual(expect.arrayContaining(['xl:min-h-0', 'xl:flex-1']));
    expect(classes(list?.parentElement)).not.toContain('flex-1');
    const name = within(group('Powyżej średniej')).getByText('Anna');
    expect(classes(name)).toEqual(expect.arrayContaining(['min-w-0', 'truncate']));
    expect(classes(name.parentElement).some((value) => value.startsWith('@max-sm:flex-col'))).toBe(true);
  });

  it('uses only theme colors', () => {
    const { container } = render(<OverallBoard overall={overall} />);
    const colors = [...container.querySelectorAll('*')].flatMap((element) => classes(element)).filter((name) => /#[0-9a-f]{3,6}\b|rgba?\(|hsla?\(/i.test(name));
    expect(colors).toEqual([]);
  });
});
