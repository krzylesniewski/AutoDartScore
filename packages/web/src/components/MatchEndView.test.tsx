import type { MatchSnapshot } from '@autoscore/schema';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCountdown } from '../game/undo-window';
import { useUndoWindow } from '../game/use-undo-window';
import { player, snapshot, summary, summaryPlayer } from '../test/snapshots';
import { LockIcon } from './icons';
import { MatchEndView, type MatchEndViewProps } from './MatchEndView';

interface Call {
  readonly url: string;
  readonly body: unknown;
}

let calls: Call[];
let respond: () => Promise<Response>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const finished = snapshot({
  eventSeq: 9,
  finished: true,
  currentPlayerId: null,
  winnerId: 'p2',
  players: [player('p1', 'Anna', { legsWon: 1 }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })],
});

const current = summary({
  finished: true,
  eventSeq: 9,
  players: [summaryPlayer('p1', { dartsThrown: 30, average: 50, legsWon: 1 }), summaryPlayer('p2', { dartsThrown: 33, average: 60, legsWon: 2 })],
  legs: [{ legIndex: 0, winnerId: 'p1', checkout: 121, dartsThrown: 6, averages: [] }],
});

function view(overrides: Partial<MatchEndViewProps> = {}) {
  const props: MatchEndViewProps = {
    state: finished,
    summary: current,
    summaryError: false,
    error: null,
    connectionLost: false,
    busy: false,
    undoLocked: false,
    undoCountdown: null,
    onUndo: vi.fn(),
    voiceEnabled: true,
    onVoiceChange: vi.fn(),
    effectsEnabled: true,
    onEffectsChange: vi.fn(),
    ...overrides,
  };
  render(<MatchEndView {...props} />);
  return props;
}

// Ekran z prawdziwym odliczaniem, tak jak składa go GameScreen.
function CountingView({ state }: { state: MatchSnapshot }) {
  const undo = useUndoWindow(state);
  return (
    <MatchEndView
      state={state}
      summary={current}
      summaryError={false}
      error={null}
      connectionLost={false}
      busy={false}
      undoLocked={undo.locked}
      undoCountdown={undo.secondsLeft === null ? null : formatCountdown(undo.secondsLeft)}
      onUndo={vi.fn()}
      voiceEnabled
      onVoiceChange={vi.fn()}
      effectsEnabled
      onEffectsChange={vi.fn()}
    />
  );
}

function lockPath(): string | null | undefined {
  const { container, unmount } = render(<LockIcon />);
  const d = container.querySelector('path')?.getAttribute('d');
  unmount();
  return d;
}

function undoButton(name: string | RegExp = /^Cofnij/): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function rematchButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Rewanż' }) as HTMLButtonElement;
}

beforeEach(() => {
  calls = [];
  respond = async () => json(201, snapshot({ id: 'm_43' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
      return respond();
    }),
  );
});

afterEach(() => {
  window.location.hash = '';
  vi.unstubAllGlobals();
});

describe('MatchEndView', () => {
  it('shows the winner, the score, the setup, the legs and the comparison table', () => {
    view();
    expect(screen.getByText('Mecz zakończony')).toBeTruthy();
    expect(screen.getByText('Bartek wygrywa')).toBeTruthy();
    expect(screen.getByText('2 : 1')).toBeTruthy();
    expect(screen.getByText('501 · Double-out · Best of 3')).toBeTruthy();
    expect(screen.getByText('Leg 1')).toBeTruthy();
    expect(screen.getByText('Anna · 6 rzutek · zamknięcie 121')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Podsumowanie meczu' });
    const rowHeaders = within(table).getAllByRole('rowheader');
    expect(rowHeaders).toHaveLength(10);
    expect(rowHeaders.map((header) => header.textContent)).toContain('Wygrane legi');
    const columns = within(table).getAllByRole('columnheader');
    expect(columns).toEqual([within(table).getByRole('columnheader', { name: 'Bartek' }), within(table).getByRole('columnheader', { name: 'Anna' })]);
  });

  it('shows the checkout and the averages of each player in a leg card', () => {
    view({ summary: { ...current, legs: [{ legIndex: 0, winnerId: 'p1', checkout: 121, dartsThrown: 6, averages: [{ playerId: 'p1', average: 74.2 }, { playerId: 'p2', average: null }] }] } });
    const legList = screen.getByRole('list', { name: 'Legi' });
    expect(within(legList).getByText('Leg 1')).toBeTruthy();
    expect(within(legList).getByText('Anna · 6 rzutek · zamknięcie 121')).toBeTruthy();
    expect(within(legList).getByText('Anna 74,20 · Bartek —')).toBeTruthy();
  });

  it('shows no averages in a leg card without them', () => {
    view();
    const legList = screen.getByRole('list', { name: 'Legi' });
    expect(within(legList).queryByText(/\d\.\d{2}|—/)).toBeNull();
  });

  it('waits for a summary as new as the state and keeps the winner card', () => {
    view({ summary: { ...current, eventSeq: 8 } });
    expect(screen.getByText('Ładowanie…')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Leg 1')).toBeNull();
    expect(screen.getByText('Bartek wygrywa')).toBeTruthy();
  });

  it('shows a failed summary and keeps the winner card', () => {
    view({ summary: null, summaryError: true });
    expect(screen.getByText('Nie udało się pobrać podsumowania')).toBeTruthy();
    expect(screen.getByText('Bartek wygrywa')).toBeTruthy();
  });

  it('links Zamknij, Zapisz i wyjdź and Nowy mecz to the start screen', () => {
    view();
    for (const name of ['Zamknij', 'Zapisz i wyjdź', 'Nowy mecz']) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe('#/');
    }
  });

  it('creates a rematch with the same players and settings and opens it', async () => {
    view();
    fireEvent.click(rematchButton());
    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_43'));
    expect(calls).toEqual([{ url: '/api/matches', body: { type: 'match', playerIds: ['p1', 'p2'], startingScore: 501, bestOf: 3 } }]);
  });

  it('sends 701 and best of 5 for a match to three legs', async () => {
    const state: MatchSnapshot = { ...finished, startingScore: 701, legsToWin: 3 };
    view({ state });
    fireEvent.click(rematchButton());
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ type: 'match', playerIds: ['p1', 'p2'], startingScore: 701, bestOf: 5 });
  });

  it('sends one request for two quick clicks and stays disabled while it is pending', async () => {
    let resolve: (response: Response) => void = () => {};
    respond = () =>
      new Promise((done) => {
        resolve = done;
      });
    view();
    fireEvent.click(rematchButton());
    fireEvent.click(rematchButton());
    await vi.waitFor(() => expect(rematchButton().disabled).toBe(true));
    expect(calls).toHaveLength(1);
    resolve(json(201, snapshot({ id: 'm_43' })));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_43'));
    expect(calls).toHaveLength(1);
  });

  it('shows a failed rematch, keeps the hash and enables the button again', async () => {
    respond = async () => json(500, { error: 'internal', message: 'boom' });
    window.location.hash = '#/matches/m1';
    view();
    fireEvent.click(rematchButton());
    expect(await screen.findByText('Nie udało się utworzyć rewanżu')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('Nie udało się utworzyć rewanżu');
    expect(window.location.hash).toBe('#/matches/m1');
    expect(rematchButton().disabled).toBe(false);
  });

  it('calls onUndo from Cofnij', () => {
    const props = view();
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });

  it('disables Cofnij while busy', () => {
    view({ busy: true });
    expect((screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('counts down on Cofnij and then disables it with the lock notice', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T20:00:48.000Z'));
    try {
      render(<CountingView state={{ ...finished, finishedAt: '2026-10-21T20:00:00.000Z', editableUntil: '2026-10-21T20:05:00.000Z' }} />);
      const button = undoButton('Cofnij (4:12)');
      expect(button.disabled).toBe(false);
      expect(button.className.split(' ')).toContain('tabular-nums');
      expect(screen.queryByText('Mecz zamknięty, nie można go już zmienić')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(undoButton('Cofnij (4:11)').disabled).toBe(false);

      act(() => {
        vi.advanceTimersByTime(251_000);
      });
      expect(undoButton('Cofnij').disabled).toBe(true);
      const notice = screen.getByText('Mecz zamknięty, nie można go już zmienić');
      expect(notice.querySelector('path')?.getAttribute('d')).toBe(lockPath());
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the lock notice once next to a locked Cofnij', () => {
    view({ undoLocked: true });
    expect(undoButton().disabled).toBe(true);
    expect(screen.getAllByText('Mecz zamknięty, nie można go już zmienić')).toHaveLength(1);
  });

  it('offers to save a guest but not a saved player', () => {
    view({ state: { ...finished, players: [player('p1', 'Anna', { legsWon: 1, guest: true }), player('p2', 'Bartek', { remaining: 0, legsWon: 2 })] } });
    expect(screen.getByRole('button', { name: 'Zapisz gracza: Anna' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zapisz gracza: Bartek' })).toBeNull();
  });

  it('shows the connection and error notices', () => {
    view({ connectionLost: true, error: 'Nie udało się cofnąć rzutki' });
    expect(screen.getByText('Brak połączenia z serwerem. Łączę ponownie…')).toBeTruthy();
    expect(screen.getByText('Nie udało się cofnąć rzutki')).toBeTruthy();
  });
});
