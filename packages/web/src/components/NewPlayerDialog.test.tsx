import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewPlayerDialog } from './NewPlayerDialog';

const message = 'Gracz o imieniu „Anna” już istnieje';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ error: 'player_name_taken', message: 'Player name Anna is already taken' }), { status: 409, headers: { 'content-type': 'application/json' } })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewPlayerDialog', () => {
  it('shows a taken name under the name field and stays open until the name changes', async () => {
    const onCreated = vi.fn();
    render(<NewPlayerDialog onCreated={onCreated} onCancel={vi.fn()} />);
    const name = screen.getByRole('textbox', { name: 'Imię' });
    fireEvent.change(name, { target: { value: ' Anna ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    const error = await screen.findByText(message);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe(error.id);

    fireEvent.change(name, { target: { value: 'Anna M' } });
    expect(screen.queryByText(message)).toBeNull();
    expect(name.getAttribute('aria-invalid')).toBeNull();
  });
});
