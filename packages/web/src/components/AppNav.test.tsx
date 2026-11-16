import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppNav } from './AppNav';

describe('AppNav', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('links to the settings', () => {
    render(<AppNav current="stats" />);
    const nav = screen.getByRole('navigation');
    const settings = within(nav).getByRole('link', { name: 'Ustawienia' });
    expect(settings.getAttribute('href')).toBe('#/settings');
    expect(settings.hasAttribute('aria-disabled')).toBe(false);
    expect(within(nav).getAllByRole('link').filter((link) => link.hasAttribute('aria-disabled'))).toEqual([]);
    expect(within(nav).queryByText('Wkrótce')).toBeNull();
  });

  it('shows the voice status from the prop instead of the stored value', () => {
    localStorage.setItem('autoscore.voice', 'on');
    const { rerender } = render(<AppNav current="settings" voiceEnabled={false} />);
    expect(screen.getByText('Głos: wyłączony')).toBeTruthy();
    rerender(<AppNav current="settings" voiceEnabled />);
    expect(screen.getByText('Głos: włączony')).toBeTruthy();
  });

  it('keeps the camera and voice status texts in the bar', () => {
    render(<AppNav current="stats" />);
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Kamera: brak')).toBeTruthy();
    expect(within(banner).getByText(/^Głos: /)).toBeTruthy();
  });

  it.each([true, false])('hides the status dots from screen readers with the voice on: %s', (voiceEnabled) => {
    render(<AppNav current="history" voiceEnabled={voiceEnabled} />);
    for (const text of ['Kamera: brak', voiceEnabled ? 'Głos: włączony' : 'Głos: wyłączony']) {
      // Status to kropka i tekst w jednym elemencie. Kropka jest pusta i ukryta, a stan niesie tekst.
      const dots = [...(screen.getByText(text).parentElement?.querySelectorAll('[aria-hidden="true"]') ?? [])];
      expect(dots).toHaveLength(1);
      expect(dots[0]?.textContent).toBe('');
    }
  });

  it('marks only the current page', () => {
    render(<AppNav current="stats" />);
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Nowa gra', 'Historia', 'Ustawienia']) {
      expect(screen.getByRole('link', { name }).hasAttribute('aria-current')).toBe(false);
    }
  });
});
