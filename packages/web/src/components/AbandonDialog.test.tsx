import { fireEvent, render, screen } from '@testing-library/react';
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
      expect(card?.querySelector('.rounded-full.font-bold[aria-hidden="true"]')?.textContent).toBe(name.charAt(0));
      expect(radio.className.split(' ')).toContain('sr-only');
      expect(card?.className.split(' ')).toContain('has-focus-visible:outline-(--color-focus)');
    }
    expect((screen.getByRole('radio', { name: 'Bartek' }) as HTMLInputElement).checked).toBe(true);
  });

  it('marks the checked card with a ring and the other with an inset line', () => {
    renderDialog();
    const checked = screen.getByRole('radio', { name: 'Bartek' }).closest('label');
    const unchecked = screen.getByRole('radio', { name: 'Anna' }).closest('label');
    expect(checked?.className.split(' ')).toContain('inset-ring-(--color-text)');
    expect(unchecked?.className.split(' ')).toContain('shadow-(--shadow-inset-line)');
    fireEvent.click(screen.getByRole('radio', { name: 'Anna' }));
    expect(screen.getByRole('radio', { name: 'Anna' }).closest('label')?.className.split(' ')).toContain('inset-ring-(--color-text)');
  });

  it('scrolls inside itself when the window is short and describes itself with the text', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Porzucić mecz?' });
    expect(dialog.className.split(' ')).toEqual(expect.arrayContaining(['max-h-full', 'overflow-y-auto', 'overflow-x-hidden', 'rounded-(--radius-panel)']));
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
