import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppNav } from './AppNav';

function classes(element: Element | null): string[] {
  return element?.getAttribute('class')?.split(' ') ?? [];
}

describe('AppNav', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('keeps the bar in one row that does not shrink on phones', () => {
    render(<AppNav current="stats" />);
    expect(classes(screen.getByRole('banner'))).toEqual(expect.arrayContaining(['shrink-0', 'max-sm:flex-nowrap']));
    expect(classes(screen.getByRole('navigation'))).toEqual(expect.arrayContaining(['max-sm:overflow-x-auto', 'max-sm:flex-nowrap', 'flex-wrap']));
  });

  it('links to the settings on every width', () => {
    render(<AppNav current="stats" />);
    const nav = screen.getByRole('navigation');
    const settings = within(nav).getByRole('link', { name: 'Ustawienia' });
    expect(settings.getAttribute('href')).toBe('#/settings');
    expect(settings.hasAttribute('aria-disabled')).toBe(false);
    expect(classes(settings)).not.toContain('max-sm:hidden');
    expect(nav.querySelector('[aria-disabled]')).toBeNull();
    expect(within(nav).queryByText('Wkrótce')).toBeNull();
  });

  it('shows the voice status from the prop instead of the stored value', () => {
    localStorage.setItem('autoscore.voice', 'on');
    const { rerender } = render(<AppNav current="settings" voiceEnabled={false} />);
    expect(screen.getByText('Głos: wyłączony')).toBeTruthy();
    rerender(<AppNav current="settings" voiceEnabled />);
    expect(screen.getByText('Głos: włączony')).toBeTruthy();
  });

  it('keeps the status texts for screen readers on phones', () => {
    render(<AppNav current="stats" />);
    expect(classes(screen.getByText('Kamera: brak'))).toContain('max-sm:sr-only');
    expect(classes(screen.getByText(/^Głos: /))).toContain('max-sm:sr-only');
  });

  it('marks only the current page', () => {
    render(<AppNav current="stats" />);
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Nowa gra', 'Historia', 'Ustawienia']) {
      expect(screen.getByRole('link', { name }).hasAttribute('aria-current')).toBe(false);
    }
  });
});
