import type { Player } from '@autoscore/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pl } from '../i18n/pl';
import { EditPlayerDialog } from './EditPlayerDialog';

const message = 'Gracz o imieniu „Anna” już istnieje';
const bartek: Player = {
  id: 'p2',
  name: 'Bartek',
  avatar: null,
  color: 7,
  guest: false,
  archivedAt: null,
  createdAt: '2026-10-15T18:30:00.000Z',
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: 'player_name_taken', message: 'Player name Anna is already taken' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('EditPlayerDialog', () => {
  it('shows a taken name under the name field and stays open until the name changes', async () => {
    const onSaved = vi.fn();
    render(<EditPlayerDialog player={bartek} onSaved={onSaved} onCancel={vi.fn()} />);
    const name = screen.getByRole('textbox', { name: 'Imię' });
    fireEvent.change(name, { target: { value: 'Anna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    const error = await screen.findByText(message);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe(error.id);

    fireEvent.change(name, { target: { value: 'Annabel' } });
    expect(screen.queryByText(message)).toBeNull();
    expect(name.getAttribute('aria-invalid')).toBeNull();
  });

  it('does not send an unchanged avatar, so an older text avatar still saves', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...bartek, avatar: 'KL', name: 'Bartek K' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    render(<EditPlayerDialog player={{ ...bartek, avatar: 'KL' }} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Imię' }), { target: { value: 'Bartek K' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ name: 'Bartek K', color: 7 });
  });

  it('sends the emoji picked from the grid', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...bartek, avatar: '🎮' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    render(<EditPlayerDialog player={bartek} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: '🎮' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as Record<string, unknown>;
    expect(body).toEqual({ name: 'Bartek', avatar: '🎮', color: 7 });
  });

  it('ignores Escape and disables Anuluj while the save is pending', async () => {
    let finish: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))),
    );
    const onCancel = vi.fn();
    render(<EditPlayerDialog player={bartek} onSaved={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    await vi.waitFor(() => expect((screen.getByRole('button', { name: 'Anuluj' }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect((screen.getByRole('dialog') as HTMLDialogElement).open).toBe(true);
    finish(json(500, { error: 'internal_error', message: 'Internal server error' }));
    await vi.waitFor(() => expect((screen.getByRole('button', { name: 'Anuluj' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('shows a Polish alert instead of the server message on a 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(500, { error: 'internal_error', message: 'Internal server error' })),
    );
    render(<EditPlayerDialog player={bartek} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect((await screen.findByRole('alert')).textContent).toBe(pl.requestFailed);
    expect(screen.queryByText('Internal server error')).toBeNull();
  });

  it('shows a Polish text instead of the English message on a 400 invalid_request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(400, { error: 'invalid_request', message: 'Invalid request: name: Too big' })),
    );
    render(<EditPlayerDialog player={bartek} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect((await screen.findByRole('alert')).textContent).toBe(pl.invalidRequest);
    expect(screen.queryByText(/Invalid request/)).toBeNull();
  });
});
