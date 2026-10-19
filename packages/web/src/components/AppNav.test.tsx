import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppNav } from './AppNav';

function classes(element: Element | null): string[] {
  return element?.getAttribute('class')?.split(' ') ?? [];
}

describe('AppNav', () => {
  it('keeps the bar in one row that does not shrink on phones', () => {
    render(<AppNav current="stats" />);
    expect(classes(screen.getByRole('banner'))).toEqual(expect.arrayContaining(['shrink-0', 'max-sm:flex-nowrap']));
    expect(classes(screen.getByRole('navigation'))).toEqual(expect.arrayContaining(['max-sm:overflow-x-auto', 'max-sm:flex-nowrap', 'flex-wrap']));
  });

  it('hides the settings item on phones and keeps it disabled', () => {
    render(<AppNav current="stats" />);
    const settings = within(screen.getByRole('navigation')).getByText('Ustawienia');
    expect(settings.getAttribute('aria-disabled')).toBe('true');
    expect(classes(settings)).toContain('max-sm:hidden');
  });

  it('keeps the status texts for screen readers on phones', () => {
    render(<AppNav current="stats" />);
    expect(classes(screen.getByText('Kamera: brak'))).toContain('max-sm:sr-only');
    expect(classes(screen.getByText(/^Głos: /))).toContain('max-sm:sr-only');
  });

  it('marks only the current page', () => {
    render(<AppNav current="stats" />);
    expect(screen.getByRole('link', { name: 'Statystyki' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Nowa gra', 'Historia']) {
      expect(screen.getByRole('link', { name }).hasAttribute('aria-current')).toBe(false);
    }
  });
});
