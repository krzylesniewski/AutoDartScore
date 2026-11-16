import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { player } from '../test/snapshots';
import { AbandonDialog } from './AbandonDialog';

const state = { players: [player('p1', 'Anna'), player('p2', 'Bartek')], currentPlayerId: 'p2' };

function renderDialog() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<AbandonDialog state={state} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
}

describe('AbandonDialog', () => {
  it('shows each player as a card label that wraps a radio and an avatar', () => {
    renderDialog();
    for (const name of ['Anna', 'Bartek']) {
      const radio = screen.getByRole('radio', { name }) as HTMLInputElement;
      const card = radio.closest('label');
      expect(card).not.toBeNull();
      expect(card?.textContent).toContain(name);
      expect(within(card as HTMLElement).getByText(name.charAt(0)).getAttribute('aria-hidden')).toBe('true');
    }
    expect((screen.getByRole('radio', { name: 'Bartek' }) as HTMLInputElement).checked).toBe(true);
  });

  it('checks the clicked card and unchecks the other', () => {
    renderDialog();
    const anna = screen.getByRole('radio', { name: 'Anna' }) as HTMLInputElement;
    const bartek = screen.getByRole('radio', { name: 'Bartek' }) as HTMLInputElement;
    expect(bartek.checked).toBe(true);
    expect(anna.checked).toBe(false);
    fireEvent.click(anna);
    expect(anna.checked).toBe(true);
    expect(bartek.checked).toBe(false);
  });

  it('describes itself with the text and focuses the window', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Porzucić mecz?' });
    const textId = dialog.getAttribute('aria-describedby');
    expect(textId).toBeTruthy();
    expect(document.getElementById(textId ?? '')?.textContent).toContain('porzucona');
    expect(document.activeElement).toBe(dialog);
  });

  it('confirms the picked player and the reason', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('radio', { name: 'Anna' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'koniec czasu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Porzuć mecz' }));
    expect(onConfirm).toHaveBeenCalledWith('p1', 'koniec czasu');
  });
});
