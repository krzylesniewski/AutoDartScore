import type { TournamentStats } from '@autoscore/schema';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentStats, tournamentStatsPlayer, tournamentView } from '../test/snapshots';
import { useTournamentStats } from './use-tournament-stats';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function statsWith(average: number): TournamentStats {
  return tournamentStats({ players: [tournamentStatsPlayer('p1', { average, dartsThrown: 30 })] });
}

const failure = () => json(500, { error: 'internal_error', message: 'Internal server error' });

interface Pending {
  readonly url: string;
  resolve(response: Response): void;
}

let pending: Pending[];

beforeEach(() => {
  pending = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (url: string) =>
        new Promise<Response>((resolve) => {
          pending.push({ url, resolve });
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Odpowiada na zapytanie o podanym indeksie (domyślnie najstarsze czekające) i czeka, aż hook przetworzy odpowiedź,
// żeby sprawdzenie „bez zmian” nie przeszło tylko dlatego, że odpowiedź jeszcze nie dotarła.
async function answer(response: Response, index = 0): Promise<void> {
  const [entry] = pending.splice(index, 1);
  if (!entry) {
    throw new Error('No pending request');
  }
  await act(async () => {
    entry.resolve(response);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

function render() {
  const view = tournamentView();
  const hook = renderHook(({ current }) => useTournamentStats(current), { initialProps: { current: view } });
  return { ...hook, view };
}

describe('useTournamentStats', () => {
  it('loads the stats on mount', async () => {
    const { result } = render();
    expect(result.current).toEqual({ status: 'loading', stats: null });
    expect(pending.map((entry) => entry.url)).toEqual(['/api/tournaments/t1/stats']);
    await answer(json(200, statsWith(40)));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.stats).toEqual(statsWith(40));
  });

  it('fetches again for every new view object and keeps the last stats meanwhile', async () => {
    const { result, rerender, view } = render();
    await answer(json(200, statsWith(40)));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ current: { ...view } });
    expect(pending.map((entry) => entry.url)).toEqual(['/api/tournaments/t1/stats']);
    expect(result.current).toEqual({ status: 'ready', stats: statsWith(40) });
    await answer(json(200, statsWith(45.5)));
    await waitFor(() => expect(result.current.stats).toEqual(statsWith(45.5)));
  });

  it('does not fetch again for the same view object', () => {
    const { rerender, view } = render();
    rerender({ current: view });
    expect(pending).toHaveLength(1);
  });

  it('ignores an older response that arrives after a newer one', async () => {
    const { result, rerender, view } = render();
    rerender({ current: { ...view } });
    expect(pending).toHaveLength(2);
    await answer(json(200, statsWith(50)), 1);
    await waitFor(() => expect(result.current.stats).toEqual(statsWith(50)));

    await answer(json(200, statsWith(30)));
    expect(result.current).toEqual({ status: 'ready', stats: statsWith(50) });
  });

  it('ignores an older failure that arrives after a newer success', async () => {
    const { result, rerender, view } = render();
    rerender({ current: { ...view } });
    await answer(json(200, statsWith(50)), 1);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await answer(failure());
    expect(result.current).toEqual({ status: 'ready', stats: statsWith(50) });
  });

  it('reports an error without earlier stats', async () => {
    const { result } = render();
    await answer(failure());
    await waitFor(() => expect(result.current).toEqual({ status: 'error', stats: null }));
  });

  it('keeps the earlier stats on a failed refetch and clears the error on a later success', async () => {
    const { result, rerender, view } = render();
    await answer(json(200, statsWith(40)));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    rerender({ current: { ...view } });
    await answer(failure());
    await waitFor(() => expect(result.current).toEqual({ status: 'error', stats: statsWith(40) }));

    rerender({ current: { ...view } });
    await answer(json(200, statsWith(42)));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', stats: statsWith(42) }));
  });

  it('ignores a response that arrives after unmount', async () => {
    const { result, unmount } = render();
    unmount();
    await answer(json(200, statsWith(40)));
    expect(result.current).toEqual({ status: 'loading', stats: null });
  });
});
