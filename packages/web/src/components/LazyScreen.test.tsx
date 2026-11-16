import { fireEvent, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyScreen } from './LazyScreen';

function Screen() {
  return <h1>Statystyki</h1>;
}

describe('LazyScreen', () => {
  it('shows the loading status while the screen code loads', () => {
    const Pending = lazy(() => new Promise(() => {}));
    render(
      <LazyScreen>
        <Pending />
      </LazyScreen>,
    );
    expect(screen.getByRole('status').textContent).toBe('Ładowanie…');
  });

  it('shows the screen once its code has loaded', async () => {
    const Loaded = lazy(() => Promise.resolve({ default: Screen }));
    render(
      <LazyScreen>
        <Loaded />
      </LazyScreen>,
    );
    expect(await screen.findByRole('heading', { name: 'Statystyki' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows an alert with a reload button when the screen code fails to load', async () => {
    // React loguje błąd złapany przez granicę błędów, a tu jest oczekiwany.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const Failed = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    render(
      <LazyScreen onReload={reload}>
        <Failed />
      </LazyScreen>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Nie udało się wczytać ekranu.');
    fireEvent.click(screen.getByRole('button', { name: 'Odśwież stronę' }));
    expect(reload).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
