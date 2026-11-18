import type { TournamentStats, TournamentView } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computedView, playedResults, tournamentConfig, tournamentStats, tournamentStatsPlayer } from '../test/snapshots';
import { TournamentStatsPanel } from './TournamentStatsPanel';

// Tekst bez avatarów i skrótów, bo są ukryte przed czytnikami ekranu.
function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent ?? '';
}

const CUP = tournamentConfig('cup', 4);

// Puchar 4 graczy bez meczu o 3. miejsce: wygrywa slot 0, więc Anna jest 1., Bartek 2., Celina i Darek 3.
function finishedCup(): TournamentView {
  return computedView(CUP, playedResults(CUP));
}

function runningCup(): TournamentView {
  return computedView(CUP);
}

function stats(overrides: Partial<TournamentStats> = {}): TournamentStats {
  return tournamentStats({
    players: [
      tournamentStatsPlayer('p1', {
        won: 2,
        legsFor: 6,
        legsAgainst: 1,
        average: 48.5,
        first9Average: 55,
        scores100: 4,
        scores140: 1,
        highestCheckout: 64,
        bestLegDarts: 18,
      }),
      tournamentStatsPlayer('p2', {
        won: 1,
        lost: 1,
        legsFor: 3,
        legsAgainst: 4,
        average: 42.25,
        first9Average: 47,
        scores100: 4,
        scores140: 0,
        highestCheckout: 40,
        bestLegDarts: 18,
      }),
      tournamentStatsPlayer('p3', { lost: 1, legsFor: 0, legsAgainst: 3, average: null, first9Average: null, scores100: 0 }),
      tournamentStatsPlayer('p4', {
        lost: 1,
        legsFor: 1,
        legsAgainst: 3,
        average: 39.1,
        first9Average: 41.5,
        scores100: 1,
        scores140: 1,
        highestCheckout: 32,
        bestLegDarts: 27,
      }),
    ],
    ...overrides,
  });
}

function playersTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Gracze w turnieju' });
}

function rowNames(): string[] {
  return within(playersTable())
    .getAllByRole('rowheader')
    .map((header) => visibleText(header));
}

function header(name: string): HTMLElement {
  const button = within(playersTable()).getByRole('button', { name });
  return button.closest('th') as HTMLElement;
}

function sortedHeaders(): [string, string][] {
  return within(playersTable())
    .getAllByRole('columnheader')
    .filter((cell) => cell.hasAttribute('aria-sort'))
    .map((cell) => [visibleText(cell), cell.getAttribute('aria-sort') ?? '']);
}

// Komórki td wiersza gracza: miejsce, potem kolumny od „Mecze” do „Najl. leg”.
function cells(name: string): HTMLTableCellElement[] {
  const row = within(playersTable()).getByRole('rowheader', { name }).closest('tr');
  return Array.from(row?.querySelectorAll('td') ?? []);
}

const AVERAGE = 4;
const SCORES_100 = 6;
const SCORES_180 = 8;
const BEST_LEG = 10;

describe('TournamentStatsPanel: podium', () => {
  it('shows the podium with place numbers once the tournament is finished, with a joint 3rd place', () => {
    render(<TournamentStatsPanel view={finishedCup()} stats={stats()} />);
    const podium = screen.getByRole('region', { name: 'Podium' });
    const items = within(podium).getAllByRole('listitem');
    expect(items.map((item) => visibleText(item))).toEqual(['1.Annafinał 4–0', '2.Bartekfinał', '3.Celinapółfinał', '3.Darekpółfinał']);
  });

  it('has no podium while the tournament runs', () => {
    render(<TournamentStatsPanel view={runningCup()} stats={stats()} />);
    expect(screen.queryByRole('region', { name: 'Podium' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Rekordy turnieju' })).toBeTruthy();
  });
});

describe('TournamentStatsPanel: records', () => {
  it('links every record to its match and shows a dash without a link for a missing record', () => {
    const view = finishedCup();
    render(
      <TournamentStatsPanel
        view={view}
        stats={stats({
          records: {
            highestMatchAverage: { playerId: 'p1', fixtureId: 'p-f', matchId: 'm p-f', value: 56.05 },
            highestCheckout: { playerId: 'p2', fixtureId: 'p-sf-2', matchId: 'm-p-sf-2', value: 64, legIndex: 1 },
            shortestLeg: null,
            highestTurn: { playerId: 'p1', fixtureId: 'p-f', matchId: 'm p-f', value: 140, legIndex: 4 },
          },
        })}
      />,
    );
    const records = screen.getByRole('region', { name: 'Rekordy turnieju' });
    const links = within(records).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Najwyższa średnia w meczu56,05AnnaFinał · rywal: Bartek', '#/matches/m%20p-f'],
      ['Najwyższe zamknięcie64BartekPółfinał 2 · leg 2', '#/matches/m-p-sf-2'],
      ['Najwyższa tura140AnnaFinał · leg 5', '#/matches/m%20p-f'],
    ]);
    const items = within(records).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toContain('Najkrótszy leg—');
    expect(within(items[2] as HTMLElement).queryByRole('link')).toBeNull();
  });

  it('shows the shortest leg in darts', () => {
    render(
      <TournamentStatsPanel
        view={finishedCup()}
        stats={stats({
          records: {
            highestMatchAverage: null,
            highestCheckout: null,
            shortestLeg: { playerId: 'p4', fixtureId: 'p-sf-1', matchId: 'm-p-sf-1', value: 18, legIndex: 0 },
            highestTurn: null,
          },
        })}
      />,
    );
    const records = screen.getByRole('region', { name: 'Rekordy turnieju' });
    expect(within(records).getByRole('link').textContent).toBe('Najkrótszy leg18 rzutekDarekPółfinał 1 · leg 1');
    expect(within(records).getAllByText('—')).toHaveLength(3);
  });
});

describe('TournamentStatsPanel: player table', () => {
  it('puts the table in a keyboard scrollable frame', () => {
    render(<TournamentStatsPanel view={runningCup()} stats={stats()} />);
    const frame = screen.getByRole('region', { name: 'Gracze w turnieju' });
    expect(frame.contains(playersTable())).toBe(true);
    expect(frame.tabIndex).toBe(0);
    // Klasa jest tu znaczeniem: tylko ta ramka przewija się w poziomie, a strona nie.
    expect(frame.classList.contains('overflow-x-auto')).toBe(true);
    expect(screen.getByText('Wszystkie mecze turnieju · kolumny można sortować')).toBeTruthy();
  });

  it('shows the columns in order with full names for screen readers and a button on every sortable header', () => {
    render(<TournamentStatsPanel view={runningCup()} stats={stats()} />);
    const headers = within(playersTable()).getAllByRole('columnheader');
    expect(headers.map((cell) => visibleText(cell))).toEqual([
      'Miejsce',
      'Gracz',
      'Mecze',
      'Legi',
      'Bilans legów',
      'Średnia',
      'First 9',
      '100+',
      '140+',
      '180',
      'Najwyższe zamknięcie',
      'Najlepszy leg',
    ]);
    expect(within(headers[1] as HTMLElement).queryByRole('button')).toBeNull();
    expect(within(playersTable()).getAllByRole('button')).toHaveLength(11);
    expect(
      within(headers[10] as HTMLElement)
        .getByText('Najw. zamkn.')
        .getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('formats the values of a row', () => {
    render(<TournamentStatsPanel view={finishedCup()} stats={stats()} />);
    expect(cells('Bartek').map((cell) => visibleText(cell))).toEqual([
      '2',
      '1–1',
      '3–4',
      '-1',
      '42,25',
      '47,00',
      '4 najlepszy wynik',
      '0',
      '0',
      '40',
      '18 najlepszy wynik',
    ]);
    expect(cells('Celina').map((cell) => visibleText(cell))).toEqual(['3', '0–1', '0–3', '-3', '—', '—', '0', '0', '0', '—', '—']);
  });

  it('shows a dash for a player without a place', () => {
    render(<TournamentStatsPanel view={runningCup()} stats={stats()} />);
    expect(visibleText(cells('Anna')[0] as HTMLElement)).toBe('—');
  });

  it('starts sorted by the average, descending, with aria-sort on Średnia only', () => {
    render(<TournamentStatsPanel view={finishedCup()} stats={stats()} />);
    expect(sortedHeaders()).toEqual([['Średnia', 'descending']]);
    expect(within(header('Średnia')).getByText('▼').getAttribute('aria-hidden')).toBe('true');
    expect(rowNames()).toEqual(['Anna', 'Bartek', 'Darek', 'Celina']);
  });

  it('re-sorts on a header click, moves aria-sort and flips it on a second click', () => {
    render(<TournamentStatsPanel view={finishedCup()} stats={stats()} />);
    fireEvent.click(within(playersTable()).getByRole('button', { name: 'Najlepszy leg' }));
    expect(sortedHeaders()).toEqual([['Najlepszy leg', 'ascending']]);
    expect(within(header('Najlepszy leg')).getByText('▲')).toBeTruthy();
    expect(rowNames()).toEqual(['Anna', 'Bartek', 'Darek', 'Celina']);

    fireEvent.click(within(playersTable()).getByRole('button', { name: 'Najlepszy leg' }));
    expect(sortedHeaders()).toEqual([['Najlepszy leg', 'descending']]);
    expect(rowNames()).toEqual(['Darek', 'Anna', 'Bartek', 'Celina']);

    fireEvent.click(within(playersTable()).getByRole('button', { name: 'Miejsce' }));
    expect(sortedHeaders()).toEqual([['Miejsce', 'ascending']]);
    expect(rowNames()).toEqual(['Anna', 'Bartek', 'Celina', 'Darek']);

    fireEvent.click(within(playersTable()).getByRole('button', { name: 'Średnia' }));
    expect(sortedHeaders()).toEqual([['Średnia', 'descending']]);
    fireEvent.click(within(playersTable()).getByRole('button', { name: 'Średnia' }));
    expect(sortedHeaders()).toEqual([['Średnia', 'ascending']]);
    expect(rowNames()).toEqual(['Darek', 'Bartek', 'Anna', 'Celina']);
  });

  it('marks the best value in each column with a star and screen reader text, ties included', () => {
    render(<TournamentStatsPanel view={finishedCup()} stats={stats()} />);
    const marked = (name: string) =>
      cells(name)
        .map((cell, index) => (cell.textContent?.includes('najlepszy wynik') ? index : null))
        .filter((index) => index !== null);
    expect(marked('Anna')).toEqual([AVERAGE, AVERAGE + 1, SCORES_100, SCORES_100 + 1, SCORES_180 + 1, BEST_LEG]);
    expect(marked('Bartek')).toEqual([SCORES_100, BEST_LEG]);
    expect(marked('Darek')).toEqual([SCORES_100 + 1]);
    expect(marked('Celina')).toEqual([]);
    const best = cells('Anna')[AVERAGE] as HTMLElement;
    expect(best.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(cells('Anna')[SCORES_180]?.textContent).toBe('0');
  });

  it('marks nothing in a column of zeros and puts a player without values last', () => {
    render(<TournamentStatsPanel view={runningCup()} stats={stats()} />);
    for (const name of ['Anna', 'Bartek', 'Celina', 'Darek']) {
      expect(cells(name)[SCORES_180]?.textContent).toBe('0');
    }
    fireEvent.click(within(playersTable()).getByRole('button', { name: 'First 9' }));
    expect(rowNames().at(-1)).toBe('Celina');
    fireEvent.click(within(playersTable()).getByRole('button', { name: 'First 9' }));
    expect(rowNames().at(-1)).toBe('Celina');
  });
});
