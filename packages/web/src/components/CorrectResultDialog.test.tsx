import type { Fixture, FixtureSlot, TournamentView } from '@autoscore/schema';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture, tournamentPlayer, tournamentView } from '../test/snapshots';
import { CorrectResultDialog } from './CorrectResultDialog';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PLAYERS = [
  tournamentPlayer('p1', 'Anna'),
  tournamentPlayer('p2', 'Bartek'),
  tournamentPlayer('p3', 'Celina'),
  tournamentPlayer('p4', 'Darek'),
];

function pair(first: string, second: string): [FixtureSlot, FixtureSlot] {
  return [
    { kind: 'player', playerId: first, seed: null },
    { kind: 'player', playerId: second, seed: null },
  ];
}

function played(number: number, first: string, second: string, legs: [number, number], overrides: Partial<Fixture> = {}): Fixture {
  return fixture({
    id: `g-${number}`,
    number,
    slots: pair(first, second),
    status: 'finished',
    matchId: `m-${number}`,
    result: { legs, winnerId: legs[0] > legs[1] ? first : second, corrected: false },
    ...overrides,
  });
}

const FIXTURES: Fixture[] = [
  played(1, 'p1', 'p2', [3, 1]),
  played(2, 'p3', 'p4', [2, 3]),
  fixture({ id: 'g-3', number: 3, slots: pair('p1', 'p3'), status: 'ready' }),
  fixture({
    id: 'g-4',
    number: 4,
    slots: pair('p2', 'p4'),
    status: 'walkover',
    result: { legs: [0, 3], winnerId: 'p4', corrected: false },
  }),
];

function leagueView(overrides: Partial<TournamentView> = {}): TournamentView {
  return tournamentView({ players: PLAYERS, fixtures: FIXTURES, nextFixtureId: 'g-3', eventSeq: 7, ...overrides });
}

const FINAL = played(5, 'p1', 'p4', [4, 2], { id: 'p-f', phase: 'playoff', bracketRound: 'final', legsToWin: 4 });

let calls: { url: string; body: unknown }[];
let reply: () => Promise<Response>;

beforeEach(() => {
  calls = [];
  reply = () => Promise.resolve(json(200, leagueView({ eventSeq: 8 })));
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

interface Handlers {
  onSaved: ReturnType<typeof vi.fn>;
  onFailed: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
}

function renderDialog(view: TournamentView = leagueView()): Handlers & { rerender(view: TournamentView): void } {
  const handlers = { onSaved: vi.fn(), onFailed: vi.fn(), onCancel: vi.fn() };
  const { rerender } = render(<CorrectResultDialog view={view} {...handlers} />);
  return { ...handlers, rerender: (next) => rerender(<CorrectResultDialog view={next} {...handlers} />) };
}

function select(): HTMLSelectElement {
  return screen.getByRole<HTMLSelectElement>('combobox', { name: 'Mecz' });
}

function legsOf(name: string): string {
  return screen.getByRole('button', { name: `Mniej legów: ${name}` }).nextElementSibling?.textContent ?? '';
}

function submit(): HTMLButtonElement {
  return within(screen.getByRole('dialog')).getAllByRole<HTMLButtonElement>('button', { name: 'Popraw wynik' })[0] as HTMLButtonElement;
}

function description(): string {
  const id = screen.getByRole('dialog').getAttribute('aria-describedby');
  return (id && document.getElementById(id)?.textContent) || '';
}

describe('CorrectResultDialog', () => {
  it('lists only finished fixtures, preselects the latest one and focuses the select', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Popraw wynik' })).toBeTruthy();
    expect(
      within(select())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Liga, mecz 1 · Anna 3–1 Bartek', 'Liga, mecz 2 · Celina 2–3 Darek']);
    expect(select().value).toBe('g-2');
    expect(document.activeElement).toBe(select());
    expect(select().className).toContain('scheme-dark');
    expect(legsOf('Celina')).toBe('2');
    expect(legsOf('Darek')).toBe('3');
  });

  it('clamps the steppers at 0 and at legsToWin', () => {
    renderDialog();
    const more = screen.getByRole<HTMLButtonElement>('button', { name: 'Więcej legów: Darek' });
    expect(more.disabled).toBe(true);
    const fewer = screen.getByRole<HTMLButtonElement>('button', { name: 'Mniej legów: Celina' });
    fireEvent.click(fewer);
    fireEvent.click(fewer);
    expect(legsOf('Celina')).toBe('0');
    expect(fewer.disabled).toBe(true);
    fireEvent.click(fewer);
    expect(legsOf('Celina')).toBe('0');
  });

  it('disables the submit for an unchanged and for an invalid score', () => {
    renderDialog();
    expect(submit().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Więcej legów: Celina' }));
    expect(legsOf('Celina')).toBe('3');
    expect(submit().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Darek' }));
    expect(submit().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Darek' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Celina' }));
    expect(submit().disabled).toBe(true);
  });

  it('shows the winner change only when the winner changes', () => {
    renderDialog();
    expect(screen.queryByText(/^Zwycięzcą meczu zostanie/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Celina' }));
    expect(submit().disabled).toBe(false);
    expect(screen.queryByText(/^Zwycięzcą meczu zostanie/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Więcej legów: Celina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Więcej legów: Celina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Darek' }));
    expect(screen.getByText('Zwycięzcą meczu zostanie Celina.')).toBeTruthy();
  });

  it('resets the legs when another match is selected', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Celina' }));
    fireEvent.change(select(), { target: { value: 'g-1' } });
    expect(legsOf('Anna')).toBe('3');
    expect(legsOf('Bartek')).toBe('1');
    fireEvent.change(select(), { target: { value: 'g-2' } });
    expect(legsOf('Celina')).toBe('2');
  });

  it('describes the rule, the league impact and the kept throws', () => {
    renderDialog();
    expect(description()).toContain('Mecz do 3 wygranych legów: zwycięzca ma 3, przegrany mniej.');
    expect(description()).toContain('Przeliczy się tabela ligi i klasyfikacja.');
    expect(description()).toContain('Rzutki meczu i statystyki rzutów zostają bez zmian.');
  });

  it('names the group impact for a group fixture', () => {
    renderDialog(leagueView({ format: 'group_playoff' }));
    expect(within(select()).getAllByRole('option')[0]?.textContent).toBe('Grupa, mecz 1 · Anna 3–1 Bartek');
    expect(description()).toContain('Przeliczy się tabela grupy i obsada play-off.');
  });

  it('names the bracket impact for a bracket fixture', () => {
    renderDialog(leagueView({ format: 'cup', fixtures: [FINAL] }));
    expect(select().value).toBe('p-f');
    expect(within(select()).getByRole('option').textContent).toBe('Finał · Anna 4–2 Darek');
    expect(description()).toContain('Mecz do 4 wygranych legów: zwycięzca ma 4, przegrany mniej.');
    expect(description()).toContain('Przeliczy się drabinka i klasyfikacja końcowa.');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Więcej legów: Darek' }).disabled).toBe(false);
  });

  it('posts the legs with the current eventSeq and passes the returned view', async () => {
    const { onSaved, onFailed } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Więcej legów: Celina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Darek' }));
    fireEvent.click(submit());
    fireEvent.click(submit());
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([{ url: '/api/tournaments/t1/fixtures/g-2/result', body: { legs: [3, 2], expectedSeq: 7 } }]);
    expect((onSaved.mock.calls[0]?.[0] as TournamentView).eventSeq).toBe(8);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('shows dependent_started in Polish as an alert and stays open', async () => {
    reply = () => Promise.resolve(json(409, { error: 'dependent_started', message: 'A dependent fixture has started' }));
    const { onSaved, onFailed, onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Celina' }));
    fireEvent.click(submit());
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Zaczął się już mecz zależny od tego wyniku, więc wyniku nie da się poprawić.',
    );
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLDialogElement>('dialog').open).toBe(true);
    expect(submit().disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Anuluj' }).disabled).toBe(false);
  });

  it('closes on Escape and on Anuluj when idle', () => {
    const { onCancel } = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape while the request runs', async () => {
    let finish: (response: Response) => void = () => undefined;
    reply = () => new Promise<Response>((resolve) => (finish = resolve));
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Celina' }));
    fireEvent.click(submit());
    await vi.waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Anuluj' }).disabled).toBe(true));
    expect(submit().disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    finish(json(500, { error: 'internal_error', message: 'Internal server error' }));
    await vi.waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Anuluj' }).disabled).toBe(false));
  });

  it('keeps the selection on a live update and sends the latest eventSeq', async () => {
    const { rerender, onSaved } = renderDialog();
    fireEvent.change(select(), { target: { value: 'g-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Anna' }));
    rerender(leagueView({ eventSeq: 9 }));
    expect(select().value).toBe('g-1');
    expect(legsOf('Anna')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Więcej legów: Bartek' }));
    fireEvent.click(screen.getByRole('button', { name: 'Więcej legów: Bartek' }));
    fireEvent.click(submit());
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls[0]?.body).toEqual({ legs: [2, 3], expectedSeq: 9 });
  });

  it('falls back to the latest finished match when the selected one is no longer correctable', () => {
    const { rerender } = renderDialog();
    fireEvent.change(select(), { target: { value: 'g-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mniej legów: Anna' }));
    const undone = FIXTURES.map((entry) => (entry.id === 'g-1' ? { ...entry, status: 'in_progress' as const, result: null } : entry));
    rerender(leagueView({ fixtures: undone, eventSeq: 8 }));
    expect(select().value).toBe('g-2');
    expect(legsOf('Celina')).toBe('2');
    expect(within(select()).getAllByRole('option')).toHaveLength(1);
  });
});
