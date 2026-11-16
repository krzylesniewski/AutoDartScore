import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArchivePlayerDialog } from './ArchivePlayerDialog';

describe('ArchivePlayerDialog', () => {
  it('opens as a focused modal dialog with corner rings hidden from screen readers', () => {
    render(<ArchivePlayerDialog name="Anna" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Zarchiwizować gracza?' });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(document.activeElement).toBe(dialog);
    expect(dialog.querySelector('svg[aria-hidden="true"]')?.querySelectorAll('circle')).toHaveLength(3);
  });

  it('confirms with Archiwizuj and cancels with Anuluj or Escape', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ArchivePlayerDialog name="Anna" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archiwizuj' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
