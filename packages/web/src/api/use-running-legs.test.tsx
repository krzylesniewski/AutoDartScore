import type { MatchSnapshot, TournamentView } from '@autoscore/schema';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computedView, player, snapshot, tournamentConfig } from '../test/snapshots';
import { useRunningLegs } from './use-running-legs';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Oba półfinały pucharu 4 graczy trwają: p1 z p4 i p2 z p3.
function liveView(): TournamentView {
  return computedView(tournamentConfig('cup', 4), { 'p-sf-1': [1, 1], 'p-sf-2': [0, 0] });
}

// Gracze w meczu w innej kolejności niż sloty, żeby legi szły po id gracza.
function match(id: string, legs: Record<string, number>, legIndex: number): MatchSnapshot {
  const players = Object.entries(legs)
    .reverse()
    .map(([playerId, legsWon]) => player(playerId, playerId, { legsWon }));
  return snapshot({ id, players, legIndex, currentPlayerId: players[0]?.id ?? null });
}

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

function urls(): string[] {
  return pending.map((entry) => entry.url);
}

// Odpowiada na wszystkie czekające zapytania o mecz i zostawia te, na które `reply` zwraca null.
async function answer(reply: (url: string) => Response | null): Promise<void> {
  const open = pending;
  pending = [];
  await act(async () => {
    for (const entry of open) {
      const response = reply(entry.url);
      if (response) {
        entry.resolve(response);
      } else {
        pending.push(entry);
      }
    }
    await Promise.resolve();
  });
}

function semiFinals(first: Record<string, number>, second: Record<string, number>, legIndex: number) {
  return (url: string): Response | null => {
    if (url.endsWith('/matches/m-p-sf-1')) {
      return json(200, match('m-p-sf-1', first, legIndex));
    }
    if (url.endsWith('/matches/m-p-sf-2')) {
      return json(200, match('m-p-sf-2', second, legIndex));
    }
    return null;
  };
}

describe('useRunningLegs', () => {
  it('loads the legs of every running fixture in slot order', async () => {
    const view = liveView();
    const { result } = renderHook(() => useRunningLegs(view));
    expect(result.current.size).toBe(0);
    expect(urls()).toEqual(['/api/matches/m-p-sf-1', '/api/matches/m-p-sf-2']);
    await answer(semiFinals({ p1: 1, p4: 2 }, { p2: 0, p3: 0 }, 2));
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get('p-sf-1')).toEqual({ legs: [1, 2], legNumber: 3 });
    expect(result.current.get('p-sf-2')).toEqual({ legs: [0, 0], legNumber: 3 });
  });

  it('counts a missing legsWon as 0', async () => {
    const view = liveView();
    const { result } = renderHook(() => useRunningLegs(view));
    await answer((url) =>
      json(200, snapshot({ id: url, players: [player('p1', 'Anna', { legsWon: null }), player('p4', 'Darek', { legsWon: null })] })),
    );
    await waitFor(() => expect(result.current.get('p-sf-1')).toEqual({ legs: [0, 0], legNumber: 1 }));
  });

  it('fetches again for every new view object', async () => {
    const view = liveView();
    const { result, rerender } = renderHook(({ current }) => useRunningLegs(current), { initialProps: { current: view } });
    await answer(semiFinals({ p1: 1, p4: 1 }, { p2: 0, p3: 0 }, 2));
    await waitFor(() => expect(result.current.get('p-sf-1')?.legs).toEqual([1, 1]));

    rerender({ current: { ...view } });
    expect(urls()).toEqual(['/api/matches/m-p-sf-1', '/api/matches/m-p-sf-2']);
    await answer(semiFinals({ p1: 2, p4: 1 }, { p2: 0, p3: 1 }, 3));
    await waitFor(() => expect(result.current.get('p-sf-1')).toEqual({ legs: [2, 1], legNumber: 4 }));
    expect(result.current.get('p-sf-2')).toEqual({ legs: [0, 1], legNumber: 4 });
  });

  it('leaves a fixture out when its request fails', async () => {
    const view = liveView();
    const { result } = renderHook(() => useRunningLegs(view));
    await answer((url) =>
      url.endsWith('/m-p-sf-1')
        ? json(500, { error: 'internal_error', message: 'Internal server error' })
        : json(200, match('m-p-sf-2', { p2: 1, p3: 0 }, 1)),
    );
    await waitFor(() => expect(result.current.get('p-sf-2')).toEqual({ legs: [1, 0], legNumber: 2 }));
    expect(result.current.has('p-sf-1')).toBe(false);
  });

  it('ignores an older round that answers after a newer one', async () => {
    const view = liveView();
    const { result, rerender } = renderHook(({ current }) => useRunningLegs(current), { initialProps: { current: view } });
    const older = pending;
    pending = [];
    rerender({ current: { ...view } });
    await answer(semiFinals({ p1: 2, p4: 1 }, { p2: 1, p3: 1 }, 3));
    await waitFor(() => expect(result.current.get('p-sf-1')?.legs).toEqual([2, 1]));

    pending = older;
    await answer(semiFinals({ p1: 0, p4: 0 }, { p2: 0, p3: 0 }, 0));
    expect(result.current.get('p-sf-1')).toEqual({ legs: [2, 1], legNumber: 4 });
    expect(result.current.get('p-sf-2')).toEqual({ legs: [1, 1], legNumber: 4 });
  });

  it('drops a fixture that is no longer running and fetches nothing without running fixtures', async () => {
    const view = liveView();
    const { result, rerender } = renderHook(({ current }) => useRunningLegs(current), { initialProps: { current: view } });
    await answer(semiFinals({ p1: 1, p4: 1 }, { p2: 0, p3: 0 }, 2));
    await waitFor(() => expect(result.current.size).toBe(2));

    const done = computedView(tournamentConfig('cup', 4), { 'p-sf-1': [3, 1], 'p-sf-2': [0, 3] });
    rerender({ current: done });
    expect(result.current.size).toBe(0);
    expect(pending).toEqual([]);
  });

  it('ignores a response that arrives after unmount', async () => {
    const view = liveView();
    const { result, unmount } = renderHook(() => useRunningLegs(view));
    unmount();
    await answer(semiFinals({ p1: 1, p4: 1 }, { p2: 0, p3: 0 }, 2));
    expect(result.current.size).toBe(0);
  });
});
