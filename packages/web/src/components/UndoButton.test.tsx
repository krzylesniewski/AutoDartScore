import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UndoButton } from './UndoButton';

function classes(element: Element): string[] {
  return element.className.split(' ').filter(Boolean);
}

describe('UndoButton', () => {
  it('is named Cofnij without a countdown', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} />);
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBeTruthy();
  });

  it('shows the time left in its name', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} countdown="4:12" />);
    const button = screen.getByRole('button', { name: 'Cofnij (4:12)' });
    expect(classes(button)).toContain('tabular-nums');
  });

  it('has the Backspace shortcut and its badge from lg', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} />);
    const button = screen.getByRole('button', { name: 'Cofnij' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-keyshortcuts')).toBe('Backspace');
    expect(classes(button)).toContain('relative');
    const badge = button.querySelector('span[aria-hidden="true"]');
    expect(badge?.textContent).toBe('Backspace');
    expect(classes(badge as Element)).toEqual(expect.arrayContaining(['absolute', 'hidden', 'lg:block']));
  });

  it('has the outline look and at least 44 px', () => {
    render(<UndoButton onUndo={() => undefined} disabled={false} className="h-14" />);
    expect(classes(screen.getByRole('button', { name: 'Cofnij' }))).toEqual(
      expect.arrayContaining(['bg-transparent', 'shadow-(--shadow-outline)', 'rounded-(--radius-button)', 'min-h-11', 'disabled:opacity-40', 'h-14']),
    );
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
    const button = screen.getByRole('button', { name: 'Cofnij' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onUndo).not.toHaveBeenCalled();
  });
});
