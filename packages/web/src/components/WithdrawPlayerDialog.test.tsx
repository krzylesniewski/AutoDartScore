import type { Fixture, TournamentView } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computedView, playedResults, tournamentConfig, type ResultLegs } from '../test/snapshots';
import { WithdrawPlayerDialog } from './WithdrawPlayerDialog';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// Liga sześciu graczy, więc każdy ma pięć meczów: Anna, Bartek, Celina, Darek, Ewa i Filip.
const LEAGUE = tournamentConfig('league', 6);

function annaFixtures(): Fixture[] {
  return computedView(LEAGUE)
    .fixtures.filter((entry) => entry.slots.some((slot) => slot.kind === 'player' && slot.playerId === 'p1'))
    .sort((first, second) => first.number - second.number);
}

// Pierwsze `count` meczów Anny rozegrane, reszta bez zmian.
function annaPlayed(count: number, preset: ResultLegs = {}): ResultLegs {
  const ids = annaFixtures()
    .slice(0, count)
    .map((entry) => entry.id);
  return playedResults(LEAGUE, preset, (entry) => ids.includes(entry.id));
}

let calls: { url: string; body: unknown }[];
let reply: () => Promise<Response>;

beforeEach(() => {
  calls = [];
  reply = () => Promise.resolve(json(201, computedView(LEAGUE, {}, { eventSeq: 9 }, { withdrawals: ['p1'] })));
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      calls.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
      return reply();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDialog(view: TournamentView) {
  const handlers = { onSaved: vi.fn(), onFailed: vi.fn(), onCancel: vi.fn() };
  const { rerender } = render(<WithdrawPlayerDialog view={view} {...handlers} />);
  return { ...handlers, rerender: (next: TournamentView) => rerender(<WithdrawPlayerDialog view={next} {...handlers} />) };
}

// Imiona z kart wyboru, bez ukrytych przed czytnikami ekranu elementów avatara.
function radios(): string[] {
  return within(screen.getByRole('group', { name: 'Gracz' }))
    .getAllByRole('radio')
    .map((radio) => {
      const copy = radio.closest('label')?.cloneNode(true) as Element | undefined;
      copy?.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
      return copy?.textContent ?? '';
    });
}

function submit(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: 'Wycofaj gracza' });
}

function description(): string {
  const id = screen.getByRole('dialog').getAttribute('aria-describedby');
  return (id && document.getElementById(id)?.textContent) || '';
}

describe('WithdrawPlayerDialog', () => {
  it('offers every player as a radio with nothing chosen and the focus on the window', () => {
    renderDialog(computedView(LEAGUE));
    const dialog = screen.getByRole('dialog', { name: 'Wycofać gracza?' });
    expect(document.activeElement).toBe(dialog);
    expect(radios()).toEqual(['Anna', 'Bartek', 'Celina', 'Darek', 'Ewa', 'Filip']);
    expect(screen.getByRole('radio', { name: /Anna/ })).toBeTruthy();
    expect(screen.getAllByRole<HTMLInputElement>('radio').some((radio) => radio.checked)).toBe(false);
    expect(submit().disabled).toBe(true);
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
  });

  it('leaves out withdrawn players and walkover losers', () => {
    renderDialog(computedView(LEAGUE, {}, {}, { withdrawals: ['p2', 'p5'] }));
    expect(screen.queryByRole('radio', { name: /Bartek/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Ewa/ })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('leaves out an eliminated cup player and a cup walkover loser', () => {
    const cup = tournamentConfig('cup', 4);
    renderDialog(computedView(cup, { 'p-sf-1': [3, 1] }, {}, { withdrawals: ['p3'] }));
    expect(screen.queryByRole('radio', { name: /Darek/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Celina/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Anna/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Bartek/ })).toBeTruthy();
  });

  it.each([
    [0, 'Anna przegra walkowerem 5 meczów.'],
    [3, 'Anna przegra walkowerem 2 mecze.'],
    [4, 'Anna przegra walkowerem 1 mecz.'],
  ])('counts the walkovers after %i played matches', (playedCount, text) => {
    renderDialog(computedView(LEAGUE, annaPlayed(playedCount)));
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    expect(screen.getByText(text)).toBeTruthy();
    expect(description()).toContain(text);
    expect(description()).toContain('Każdy kolejny mecz tego gracza w turnieju też będzie walkowerem. Rozegrane mecze zostają bez zmian.');
    expect(screen.queryByText(/^Trwający mecz/)).toBeNull();
    expect(submit().disabled).toBe(false);
  });

  it('says that a player without open matches only changes the table', () => {
    renderDialog(computedView(LEAGUE, annaPlayed(5)));
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    expect(screen.getByText('Anna nie ma już meczów do rozegrania. Zmieni się tylko oznaczenie w tabeli.')).toBeTruthy();
    expect(screen.queryByText(/przegra walkowerem/)).toBeNull();
  });

  it('names the running match that gets abandoned', () => {
    const running = annaFixtures()[0] as Fixture;
    renderDialog(computedView(LEAGUE, { [running.id]: [1, 1] }));
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    expect(screen.getByText('Anna przegra walkowerem 5 meczów.')).toBeTruthy();
    expect(screen.getByText(`Trwający mecz (liga, mecz ${running.number}) zostanie porzucony i liczy się jako walkower.`)).toBeTruthy();
  });

  it('shows the selection with the checked radio', () => {
    renderDialog(computedView(LEAGUE));
    const bartek = screen.getByRole<HTMLInputElement>('radio', { name: /Bartek/ });
    fireEvent.click(bartek);
    expect(bartek.checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /Anna/ }).checked).toBe(false);
  });

  it('posts the player with the current eventSeq and passes the returned view', async () => {
    const { onSaved, onFailed } = renderDialog(computedView(LEAGUE, {}, { eventSeq: 8 }));
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    fireEvent.click(submit());
    fireEvent.click(submit());
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([{ url: '/api/tournaments/t1/withdrawals', body: { playerId: 'p1', expectedSeq: 8 } }]);
    expect((onSaved.mock.calls[0]?.[0] as TournamentView).eventSeq).toBe(9);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('shows already_withdrawn in Polish as an alert and stays open', async () => {
    reply = () => Promise.resolve(json(409, { error: 'already_withdrawn', message: 'Player has already withdrawn' }));
    const { onSaved, onFailed, onCancel } = renderDialog(computedView(LEAGUE));
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    fireEvent.click(submit());
    expect((await screen.findByRole('alert')).textContent).toBe('Ten gracz jest już wycofany.');
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLDialogElement>('dialog').open).toBe(true);
    expect(submit().disabled).toBe(false);
  });

  it('closes on Escape and on Anuluj when idle, and ignores Escape while busy', async () => {
    let finish: (response: Response) => void = () => undefined;
    reply = () => new Promise<Response>((resolve) => (finish = resolve));
    const { onCancel } = renderDialog(computedView(LEAGUE));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    fireEvent.click(submit());
    await vi.waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Anuluj' }).disabled).toBe(true));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    finish(json(500, { error: 'internal_error', message: 'Internal server error' }));
    await vi.waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Anuluj' }).disabled).toBe(false));
  });

  it('unselects a player withdrawn meanwhile and sends the latest eventSeq', async () => {
    const { rerender, onSaved } = renderDialog(computedView(LEAGUE));
    fireEvent.click(screen.getByRole('radio', { name: /Anna/ }));
    rerender(computedView(LEAGUE, {}, { eventSeq: 5 }, { withdrawals: ['p1'] }));
    expect(screen.queryByRole('radio', { name: /Anna/ })).toBeNull();
    expect(screen.getAllByRole<HTMLInputElement>('radio').some((radio) => radio.checked)).toBe(false);
    expect(submit().disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: /Celina/ }));
    fireEvent.click(submit());
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0]?.body).toEqual({ playerId: 'p3', expectedSeq: 5 });
  });
});
