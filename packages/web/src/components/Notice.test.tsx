import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
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
    expect(notice.contains(link)).toBe(true);
    expect(notice.textContent).toBe('Gra porzuconaEkran startowy');
  });
});
