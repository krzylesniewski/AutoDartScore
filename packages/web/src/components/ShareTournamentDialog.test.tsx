import type { TournamentView } from '@autoscore/schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tournamentView } from '../test/snapshots';
import { ShareTournamentDialog } from './ShareTournamentDialog';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const NETWORK_PAGE = { hostname: '192.168.1.20', origin: 'http://192.168.1.20:5173', pathname: '/app/' };
const URL = 'http://192.168.1.20:5173/app/#/t/t%201';
const LOCAL_TEXT =
  'Udostępnianie wymaga otwarcia aplikacji po adresie w sieci (adres IP komputera albo adres publiczny). Adres localhost działa tylko na tym urządzeniu.';

let calls: { url: string; method: string; body: unknown }[];
let reply: () => Promise<Response>;

beforeEach(() => {
  calls = [];
  reply = () => Promise.resolve(json(200, tournamentView({ id: 't 1', sharing: false, eventSeq: 8 })));
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
      return reply();
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderDialog(view: TournamentView = tournamentView({ id: 't 1', eventSeq: 7 }), page: typeof NETWORK_PAGE = NETWORK_PAGE) {
  const handlers = { onAccept: vi.fn(), onFailed: vi.fn(), onClose: vi.fn() };
  const result = render(<ShareTournamentDialog view={view} page={page} {...handlers} />);
  const rerender = (next: TournamentView) => result.rerender(<ShareTournamentDialog view={next} page={page} {...handlers} />);
  return { ...handlers, rerender };
}

function toggle(): HTMLElement {
  return screen.getByRole('button', { name: 'Publiczny link z kodem QR' });
}

describe('ShareTournamentDialog on a network address', () => {
  it('shows the title, the text, the toggle, the link field and the QR code', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Udostępnij turniej' })).toBeTruthy();
    expect(
      screen.getByText('Każdy z linkiem zobaczy wyniki, tabelę, drabinkę i statystyki bez logowania. Nie może niczego zmienić.'),
    ).toBeTruthy();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Adres publicznego linku' });
    expect(field.value).toBe(URL);
    expect(field.readOnly).toBe(true);
    expect(screen.getByRole('img', { name: 'Kod QR publicznego linku' }).tagName.toLowerCase()).toBe('svg');
    expect(screen.queryByText(LOCAL_TEXT)).toBeNull();
  });

  it('copies the link to the clipboard and confirms it', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj link' }));
    expect(writeText).toHaveBeenCalledWith(URL);
    expect((await screen.findByRole('status')).textContent).toBe('Skopiowano link.');
  });

  it('selects the address for manual copy without a clipboard', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj link' }));
    expect((await screen.findByText('Nie udało się skopiować. Adres jest zaznaczony, skopiuj go ręcznie.')).getAttribute('role')).toBe(
      'status',
    );
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Adres publicznego linku' });
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, URL.length]);
  });

  it('falls back to manual copy when the clipboard rejects', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Kopiuj link' }));
    expect(await screen.findByText('Nie udało się skopiować. Adres jest zaznaczony, skopiuj go ręcznie.')).toBeTruthy();
  });

  it('turns sharing off with expectedSeq, passes the view on and then shows the sharing-off text', async () => {
    const { onAccept, rerender } = renderDialog();
    await act(async () => {
      fireEvent.click(toggle());
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    expect(calls).toEqual([{ url: '/api/tournaments/t%201/sharing', method: 'POST', body: { sharing: false, expectedSeq: 7 } }]);
    const accepted = onAccept.mock.calls[0]?.[0] as TournamentView;
    expect(accepted.sharing).toBe(false);

    rerender(accepted);
    expect(screen.getByText('Udostępnianie jest wyłączone. Link i kod QR pojawią się po włączeniu.')).toBeTruthy();
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kopiuj link' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Kod QR publicznego linku' })).toBeNull();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('turns sharing on from the off state', async () => {
    const { onAccept } = renderDialog(tournamentView({ id: 't 1', sharing: false, eventSeq: 3 }));
    fireEvent.click(toggle());
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    expect(calls[0]?.body).toEqual({ sharing: true, expectedSeq: 3 });
  });

  it('blocks the toggle, Escape and Zamknij while saving', async () => {
    let finish: (response: Response) => void = () => undefined;
    reply = () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      });
    const { onClose, onAccept } = renderDialog();
    fireEvent.click(toggle());
    expect((toggle() as HTMLButtonElement).matches(':disabled')).toBe(true);
    const close = screen.getByRole<HTMLButtonElement>('button', { name: 'Zamknij' });
    expect(close.disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      finish(json(200, tournamentView({ id: 't 1', sharing: false, eventSeq: 8 })));
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(onAccept).toHaveBeenCalledTimes(1));
    expect((toggle() as HTMLButtonElement).matches(':disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an API error as an alert and reports the failure', async () => {
    reply = () => Promise.resolve(json(409, { error: 'tournament_archived', message: 'Tournament is archived' }));
    const { onFailed, onAccept } = renderDialog();
    fireEvent.click(toggle());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toBe('');
    expect(alert.querySelector('svg')).toBeTruthy();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });
});

describe.each(['localhost', '127.0.0.1'])('ShareTournamentDialog on %s', (hostname) => {
  const page = { hostname, origin: `http://${hostname}:5173`, pathname: '/' };

  it('hides the link, the copy button and the QR code, explains why and keeps the toggle', () => {
    renderDialog(tournamentView({ id: 't 1' }), page);
    const message = screen.getByText(LOCAL_TEXT);
    expect(message.querySelector('svg')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kopiuj link' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Kod QR publicznego linku' })).toBeNull();
    expect(screen.queryByText(/#\/t\//)).toBeNull();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
  });
});
