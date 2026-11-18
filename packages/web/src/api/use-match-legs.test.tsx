import type { MatchLegs } from '@autoscore/schema';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchLeg, matchLegs, scoredTurns } from '../test/snapshots';
import { useMatchLegs } from './use-match-legs';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const failure = () => json(500, { error: 'internal_error', message: 'Internal server error' });

function legsAt(eventSeq: number): MatchLegs {
  const turns = scoredTurns('p1', new Array<number>(eventSeq).fill(60));
  return matchLegs([matchLeg({ turns })], { eventSeq });
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

// Odpowiada na zapytanie o podanym indeksie i czeka, aż hook przetworzy odpowiedź.
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

function render(eventSeq: number | null) {
  return renderHook(({ seq }) => useMatchLegs('m 1', seq), { initialProps: { seq: eventSeq } });
}

describe('useMatchLegs', () => {
  it('waits for the first eventSeq and then loads the legs by the encoded id', async () => {
    const { result, rerender } = render(null);
    expect(pending).toHaveLength(0);
    expect(result.current).toEqual({ legs: null, error: false });
    rerender({ seq: 1 });
    expect(pending.map((entry) => entry.url)).toEqual(['/api/matches/m%201/legs']);
    await answer(json(200, legsAt(1)));
    expect(result.current).toEqual({ legs: legsAt(1), error: false });
  });

  it('fetches on every new eventSeq and keeps the response with the highest one', async () => {
    const { result, rerender } = render(1);
    rerender({ seq: 2 });
    expect(pending).toHaveLength(2);
    await answer(json(200, legsAt(2)), 1);
    expect(result.current.legs).toEqual(legsAt(2));
    await answer(json(200, legsAt(1)));
    expect(result.current.legs).toEqual(legsAt(2));
  });

  it('keeps the last legs after an error and clears the error with the next answer', async () => {
    const { result, rerender } = render(1);
    await answer(json(200, legsAt(1)));
    rerender({ seq: 2 });
    await answer(failure());
    expect(result.current).toEqual({ legs: legsAt(1), error: true });
    rerender({ seq: 3 });
    await answer(json(200, legsAt(3)));
    expect(result.current).toEqual({ legs: legsAt(3), error: false });
  });

  it('ignores a response after unmount', async () => {
    const { result, unmount } = render(1);
    unmount();
    await answer(json(200, legsAt(1)));
    expect(result.current).toEqual({ legs: null, error: false });
  });
});
