import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UndoButton } from './UndoButton';

describe('UndoButton', () => {
  it('is named Cofnij without a countdown', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} />);
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBeTruthy();
  });

  it('shows the time left in its name', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} countdown="4:12" />);
    expect(screen.getByRole('button', { name: 'Cofnij (4:12)' })).toBeTruthy();
  });

  it('has the Backspace shortcut and its badge', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} />);
    const button = screen.getByRole('button', { name: 'Cofnij' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Backspace');
    expect(within(button).getByText('Backspace').getAttribute('aria-hidden')).toBe('true');
  });

  it('calls onUndo on a click', () => {
    const onUndo = vi.fn<() => void>();
    render(<UndoButton onUndo={onUndo} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cofnij' }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const onUndo = vi.fn<() => void>();
    render(<UndoButton onUndo={onUndo} disabled />);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Cofnij' });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onUndo).not.toHaveBeenCalled();
  });
});
