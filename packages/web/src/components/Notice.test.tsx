import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('writes the message in the text color with an accent icon', () => {
    render(<Notice text="Nie udało się wczytać historii" />);
    const text = screen.getByText('Nie udało się wczytać historii');
    const classes = text.className.split(' ');
    expect(classes).toContain('text-(--color-text)');
    expect(classes).not.toContain('text-(--color-accent)');
    expect(text.querySelector('svg')?.getAttribute('class')).toContain('text-(--color-accent)');
  });

  it('is announced as an alert by default', () => {
    render(<Notice text="Brak połączenia" />);
    expect(screen.getByRole('alert').textContent).toBe('Brak połączenia');
  });

  it('is announced as a status with the status tone', () => {
    render(<Notice text="Tylko do odczytu" tone="status" />);
    expect(screen.getByRole('status').textContent).toBe('Tylko do odczytu');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the children after the text', () => {
    render(
      <Notice text="Gra porzucona" tone="status">
        <a href="#/">Ekran startowy</a>
      </Notice>,
    );
    const notice = screen.getByRole('status');
    const link = screen.getByRole('link', { name: 'Ekran startowy' });
    expect(notice.lastChild).toBe(link);
    expect(notice.textContent).toBe('Gra porzuconaEkran startowy');
  });
});
