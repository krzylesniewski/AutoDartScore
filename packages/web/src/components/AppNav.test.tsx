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
    expect(classes(screen.getByRole('banner'))).toEqual(expect.arrayContaining(['shrink-0', 'sc-appbar']));
    expect(classes(screen.getByRole('navigation'))).toContain('sc-nav');
    expect(screen.getByRole('banner').outerHTML).not.toContain('overflow-x-auto');
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
    for (const text of ['Kamera: brak', /^Głos: /]) {
      const element = screen.getByText(text);
      expect(classes(element).some((name) => name.endsWith('sr-only'))).toBe(false);
      expect(classes(element.parentElement)).toContain('sc-status');
    }
  });

  it('tells the voice states apart by a filled dot and a hollow ring', () => {
    const dot = (text: string) => screen.getByText(text).previousElementSibling;
    const { rerender } = render(<AppNav current="history" voiceEnabled />);
    expect(classes(dot('Głos: włączony'))).toContain('bg-(--color-status-ok)');
    expect(classes(dot('Głos: włączony'))).not.toContain('border-2');
    expect(dot('Głos: włączony')?.getAttribute('aria-hidden')).toBe('true');
    rerender(<AppNav current="history" voiceEnabled={false} />);
    expect(classes(dot('Głos: wyłączony'))).toEqual(expect.arrayContaining(['border-2', 'border-(--color-text-muted)']));
    expect(classes(dot('Głos: wyłączony'))).not.toContain('bg-(--color-status-ok)');
    expect(classes(dot('Kamera: brak'))).toContain('border-2');
  });

  it('marks only the current page', () => {
    render(<AppNav current="stats" />);
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Nowa gra', 'Historia', 'Ustawienia']) {
      expect(screen.getByRole('link', { name }).hasAttribute('aria-current')).toBe(false);
    }
  });
});
