import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { casual, player, snapshot, summary, summaryPlayer } from '../test/snapshots';
import { MatchSummaryPanel } from './MatchSummaryPanel';

function table(): HTMLElement {
  return screen.getByRole('table', { name: 'Podsumowanie meczu' });
}

function rowLabels(): string[] {
  return within(table())
    .getAllByRole('rowheader')
    .map((header) => header.textContent ?? '');
}

function columnNames(): string[] {
  return within(table())
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '');
}

function row(label: string): string[] {
  const header = within(table()).getByRole('rowheader', { name: label });
  return within(header.closest('tr') as HTMLElement)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

const match = snapshot({
  eventSeq: 30,
  finished: true,
  currentPlayerId: null,
  winnerId: 'p2',
  players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })],
});

const matchSummary = summary({
  finished: true,
  eventSeq: 30,
  players: [
    summaryPlayer('p1', { dartsThrown: 45, average: 60.2, first9Average: 81, scores100: 2, scores60: 4, highestCheckout: 40, doubleAttempts: 4, doublesHit: 1, doublesPercent: 25, bestLegDarts: 15, legsWon: 1 }),
    summaryPlayer('p2', { dartsThrown: 48, average: 62.5, first9Average: 70.33, scores180: 1, scores140: 1, highestCheckout: 121, doubleAttempts: 3, doublesHit: 2, doublesPercent: 66.7, bestLegDarts: 12, legsWon: 2 }),
  ],
  legs: [
    { legIndex: 0, winnerId: 'p2', checkout: 121, dartsThrown: 12, averages: [{ playerId: 'p1', average: 55 }, { playerId: 'p2', average: 75.25 }] },
    { legIndex: 1, winnerId: 'p1', checkout: 40, dartsThrown: 15, averages: [{ playerId: 'p1', average: 100.2 }, { playerId: 'p2', average: 60 }] },
    { legIndex: 2, winnerId: 'p2', checkout: 32, dartsThrown: 21, averages: [{ playerId: 'p1', average: 40 }, { playerId: 'p2', average: 43 }] },
  ],
});

describe('MatchSummaryPanel', () => {
  it('summarises a 1v1 match with the legs', () => {
    render(<MatchSummaryPanel state={match} summary={matchSummary} error={false} />);
    expect(screen.getByRole('heading', { name: 'Koniec meczu' })).toBeTruthy();
    expect(screen.getByText('Bartek 2:1 w legach')).toBeTruthy();
    expect(columnNames()).toEqual(['Anna', 'Bartek']);
    expect(rowLabels()).toEqual([
      'Średnia (3 rzutki)',
      'First 9',
      '180',
      '140+',
      '100+',
      '60+',
      'Najwyższe zamknięcie',
      '% doubli',
      'Najlepszy leg',
      'Wygrane legi',
    ]);
    expect(row('Średnia (3 rzutki)')).toEqual(['60,20', '62,50']);
    expect(row('% doubli')).toEqual(['25,0% (1/4)', '66,7% (2/3)']);
    expect(row('Najlepszy leg')).toEqual(['15 rzutek', '12 rzutek']);
    expect(row('Wygrane legi')).toEqual(['1', '2']);
    expect(screen.getByText('Leg 1: Bartek · 12 rzutek · zamknięcie 121')).toBeTruthy();
    expect(screen.getByText('Anna 55,00 · Bartek 75,25')).toBeTruthy();
    expect(screen.getByText('Leg 3: Bartek · 21 rzutek · zamknięcie 32')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Nowa gra' }).getAttribute('href')).toBe('#/');
  });

  it('orders a casual game by place and has no legs', () => {
    const state = casual(['Anna', 'Bartek', 'Celina'], {
      eventSeq: 40,
      finished: true,
      currentPlayerId: null,
      placements: [
        { playerId: 'p3', place: 1 },
        { playerId: 'p1', place: 2 },
        { playerId: 'p2', place: 3 },
      ],
    });
    const casualSummary = summary({
      type: 'casual',
      finished: true,
      eventSeq: 40,
      players: [summaryPlayer('p1', { average: 40 }), summaryPlayer('p2', { average: 30 }), summaryPlayer('p3', { average: 50, legsWon: 1 })],
    });
    render(<MatchSummaryPanel state={state} summary={casualSummary} error={false} />);
    expect(screen.getByText('1. miejsce Celina')).toBeTruthy();
    expect(columnNames()).toEqual(['Celina', 'Anna', 'Bartek']);
    expect(row('Średnia (3 rzutki)')).toEqual(['50,00', '40,00', '30,00']);
    expect(rowLabels()).not.toContain('Wygrane legi');
    expect(screen.queryByText(/^Leg 1:/)).toBeNull();
  });

  it('summarises a Solo 501 without the Wygrane legi row', () => {
    const state = snapshot({
      type: 'practice',
      practiceMode: 'solo_501',
      legsToWin: null,
      eventSeq: 9,
      finished: true,
      currentPlayerId: null,
      winnerId: 'p1',
      players: [player('p1', 'Anna', { remaining: 0 })],
    });
    const soloSummary = summary({
      type: 'practice',
      finished: true,
      eventSeq: 9,
      players: [summaryPlayer('p1', { dartsThrown: 9, average: 167, first9Average: 167, scores180: 2, scores140: 1, highestCheckout: 141, bestLegDarts: 9 })],
      legs: [{ legIndex: 0, winnerId: 'p1', checkout: 141, dartsThrown: 9, averages: [{ playerId: 'p1', average: 167 }] }],
    });
    render(<MatchSummaryPanel state={state} summary={soloSummary} error={false} />);
    expect(columnNames()).toEqual(['Anna']);
    expect(rowLabels()).not.toContain('Wygrane legi');
    expect(row('Najwyższe zamknięcie')).toEqual(['141']);
    expect(screen.getByText('Leg 1: Anna · 9 rzutek · zamknięcie 141')).toBeTruthy();
    expect(screen.getByText('Anna 167,00')).toBeTruthy();
  });

  it('shows the result and Ładowanie… until the summary of the final state arrives', () => {
    const { rerender } = render(<MatchSummaryPanel state={match} summary={null} error={false} />);
    expect(screen.getByText('Bartek 2:1 w legach')).toBeTruthy();
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    rerender(<MatchSummaryPanel state={match} summary={{ ...matchSummary, eventSeq: 29 }} error={false} />);
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows an error text when the summary fails', () => {
    render(<MatchSummaryPanel state={match} summary={null} error />);
    expect(screen.getByText('Nie udało się pobrać podsumowania')).toBeTruthy();
  });
});

describe('MatchSummaryPanel: saving a guest', () => {
  let requests: { url: string; method: string; body: unknown }[];
  let status: number;

  beforeEach(() => {
    requests = [];
    status = 200;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
        requests.push({ url, method: init.method ?? 'GET', body });
        const response =
          status === 200
            ? { id: 'p2', name: 'Bartek', avatar: null, color: 7, guest: false, archivedAt: null, createdAt: '2026-10-15T18:30:00.000Z' }
            : { error: 'internal_error', message: 'Internal server error' };
        return new Response(JSON.stringify(response), { status, headers: { 'content-type': 'application/json' } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const withGuest = snapshot({ ...match, players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2, guest: true })] });

  it('saves a guest with PATCH guest false and then says Zapisano', async () => {
    render(<MatchSummaryPanel state={withGuest} summary={matchSummary} error={false} />);
    expect(screen.queryByRole('button', { name: 'Zapisz gracza: Anna' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz gracza: Bartek' }));
    expect(await screen.findByText('Zapisano')).toBeTruthy();
    expect(requests).toEqual([{ url: '/api/players/p2', method: 'PATCH', body: { guest: false } }]);
    expect(screen.queryByRole('button', { name: /Zapisz gracza/ })).toBeNull();
  });

  it('shows a warning when saving fails', async () => {
    status = 500;
    render(<MatchSummaryPanel state={withGuest} summary={matchSummary} error={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz gracza: Bartek' }));
    expect(await screen.findByText('Nie udało się zapisać gracza')).toBeTruthy();
    expect(screen.queryByText('Zapisano')).toBeNull();
  });

  it('has no save button without guests', () => {
    render(<MatchSummaryPanel state={match} summary={matchSummary} error={false} />);
    expect(screen.queryByRole('button', { name: /Zapisz gracza/ })).toBeNull();
    expect(screen.queryByText('Zapisz gracza')).toBeNull();
  });
});
