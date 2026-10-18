import { CreateMatchRequest } from '@autoscore/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshot } from '../test/snapshots';
import { NewGameScreen } from './NewGameScreen';

interface Call {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

let calls: Call[];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const createdAt = '2026-10-15T18:30:00.000Z';
const players = [
  { id: 'p1', name: 'Anna', avatar: null, guest: false, createdAt },
  { id: 'p2', name: 'Bartek', avatar: '🎯', guest: false, createdAt },
];

beforeEach(() => {
  calls = [];
  window.location.hash = '#/';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });
      if (url === '/api/players' && method === 'GET') {
        return json(200, players);
      }
      if (url === '/api/players') {
        return json(201, { id: 'g1', name: body.name, avatar: body.avatar ?? null, guest: body.guest, createdAt });
      }
      return json(201, snapshot({ id: 'm_7' }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function startButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Start gry' }) as HTMLButtonElement;
}

describe('NewGameScreen', () => {
  it('enables Start gry for Mecz 1v1 only with two players', async () => {
    render(<NewGameScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Mecz 1v1' }));
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }));
    expect(startButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Bartek/ }));
    expect(startButton().disabled).toBe(false);
  });

  it('posts a valid request in pick order and opens the game', async () => {
    render(<NewGameScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Bartek/ }));
    fireEvent.click(screen.getByRole('button', { name: /Anna/ }));
    fireEvent.click(screen.getByRole('button', { name: '701' }));
    fireEvent.click(startButton());

    await vi.waitFor(() => expect(window.location.hash).toBe('#/matches/m_7'));
    const request = calls.find((call) => call.url === '/api/matches');
    expect(request?.method).toBe('POST');
    expect(CreateMatchRequest.safeParse(request?.body).success).toBe(true);
    expect(request?.body).toEqual({ type: 'match', playerIds: ['p2', 'p1'], startingScore: 701, bestOf: 3 });
  });

  it('adds a guest inline and selects it', async () => {
    render(<NewGameScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Trening' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Nowy gracz' }));
    fireEvent.change(screen.getByLabelText('Imię'), { target: { value: ' Gosia ' } });
    fireEvent.click(screen.getByLabelText('Gość'));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    const guest = await screen.findByRole('button', { name: /Gosia/ });
    expect(guest.getAttribute('aria-pressed')).toBe('true');
    expect(calls.find((call) => call.url === '/api/players' && call.method === 'POST')?.body).toEqual({ name: 'Gosia', guest: true });
    expect(startButton().disabled).toBe(false);
  });

  it('shows the server message when the game cannot start', async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      url === '/api/players' ? json(200, players) : json(400, { error: 'unknown_player', message: 'Unknown player p2' }),
    );
    render(<NewGameScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bartek/ }));
    fireEvent.click(startButton());
    expect(await screen.findByText('Unknown player p2')).toBeTruthy();
  });
});
