import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

let respond: () => Response;
let onLoggedIn: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  respond = () => json(200, { token: 't1', expiresAt: '2027-04-18T00:00:00.000Z' });
  onLoggedIn = vi.fn<() => void>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => respond()),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

function submit(password: string): void {
  fireEvent.change(screen.getByLabelText('Hasło'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Zaloguj' }));
}

describe('LoginScreen', () => {
  it('shows the app name and focuses the password field', () => {
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    expect(screen.getByRole('heading', { level: 1, name: 'AUTO Score' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Hasło'));
  });

  it('disables the button while the field is empty', () => {
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    const button = screen.getByRole('button', { name: 'Zaloguj' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Hasło'), { target: { value: 'x' } });
    expect(button.disabled).toBe(false);
  });

  it('saves the token and calls onLoggedIn once', async () => {
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    submit('secret');
    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('autoscore.token')).toBe('t1');
  });

  it('shows a wrong password with an icon and keeps the typed text', async () => {
    respond = () => json(401, { error: 'invalid_password', message: 'Invalid password' });
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    submit('wrong');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Nieprawidłowe hasło');
    expect(alert.querySelector('svg')).not.toBeNull();
    expect(localStorage.getItem('autoscore.token')).toBeNull();
    expect(onLoggedIn).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Hasło') as HTMLInputElement).value).toBe('wrong');
  });

  it('shows too many attempts on 429', async () => {
    respond = () => json(429, { error: 'too_many_attempts', message: 'Too many attempts' });
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    submit('wrong');
    expect((await screen.findByRole('alert')).textContent).toBe('Za dużo prób, spróbuj za minutę');
  });

  it('shows a failed request on other errors', async () => {
    respond = () => json(500, { error: 'internal', message: 'Boom' });
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    submit('secret');
    expect((await screen.findByRole('alert')).textContent).toBe('Nie udało się połączyć z serwerem');
  });

  it('clears the error on the next submit', async () => {
    let resolve: (response: Response) => void = () => undefined;
    respond = () => json(401, { error: 'invalid_password', message: 'Invalid password' });
    render(<LoginScreen onLoggedIn={onLoggedIn} />);
    submit('wrong');
    await screen.findByRole('alert');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((done) => (resolve = done))),
    );
    submit('secret');
    expect(screen.queryByRole('alert')).toBeNull();
    resolve(json(200, { token: 't1', expiresAt: '2027-04-18T00:00:00.000Z' }));
    await vi.waitFor(() => expect(onLoggedIn).toHaveBeenCalledTimes(1));
  });
});
