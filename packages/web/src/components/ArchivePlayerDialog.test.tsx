import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArchivePlayerDialog } from './ArchivePlayerDialog';

describe('ArchivePlayerDialog', () => {
  it('opens as a focused modal dialog on a dimmed screen', () => {
    render(<ArchivePlayerDialog name="Anna" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Zarchiwizować gracza?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
    expect(dialog.parentElement?.classList).toContain('bg-(--color-bg)/80');
    expect(dialog.querySelector('svg[aria-hidden="true"]')?.querySelectorAll('circle')).toHaveLength(3);
  });

  it('confirms with Archiwizuj and cancels with Anuluj or Escape', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ArchivePlayerDialog name="Anna" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archiwizuj' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
