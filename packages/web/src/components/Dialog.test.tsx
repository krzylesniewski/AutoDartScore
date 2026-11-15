import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, type DialogProps } from './Dialog';

function TestDialog({ withInitialFocus = false, ...props }: Partial<DialogProps> & { withInitialFocus?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Dialog labelledBy="title" onClose={vi.fn()} {...props} {...(withInitialFocus ? { initialFocus: input } : {})}>
      <h2 id="title">Okno</h2>
      <input ref={input} aria-label="Imię" />
    </Dialog>
  );
}

function dialog(): HTMLDialogElement {
  return screen.getByRole('dialog', { name: 'Okno' }) as HTMLDialogElement;
}

const openers: HTMLButtonElement[] = [];

function focusedOpener(): HTMLButtonElement {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  openers.push(opener);
  return opener;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const opener of openers.splice(0)) {
    opener.remove();
  }
});

describe('Dialog', () => {
  // Pułapkę fokusu i bezwładne tło daje top layer przeglądarki po showModal(), a jsdom go nie ma.
  // Dlatego ten test zastępuje sprawdzenie, że Tab nie wychodzi poza okno.
  it('opens as a modal with showModal()', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<TestDialog />);
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog().open).toBe(true);
  });

  it('focuses the dialog without initialFocus', () => {
    render(<TestDialog />);
    expect(document.activeElement).toBe(dialog());
  });

  it('focuses initialFocus when given', () => {
    render(<TestDialog withInitialFocus />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Imię' }));
  });

  it('calls onClose on Escape and prevents the default', () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    expect(fireEvent.keyDown(dialog(), { key: 'Escape' })).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores Escape and a cancel request while busy', () => {
    const onClose = vi.fn();
    render(<TestDialog busy onClose={onClose} />);
    expect(fireEvent.keyDown(dialog(), { key: 'Escape' })).toBe(false);
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().open).toBe(true);
  });

  it('calls onClose on a cancel request when not busy', () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog(), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the dialog closes', () => {
    const onClose = vi.fn();
    render(<TestDialog onClose={onClose} />);
    dialog().close();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens again instead of closing while busy', () => {
    const onClose = vi.fn();
    render(<TestDialog busy onClose={onClose} />);
    const element = dialog();
    element.close();
    expect(element.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns the focus to the opener after unmount', () => {
    const opener = focusedOpener();
    const onClose = vi.fn();
    const { unmount } = render(<TestDialog onClose={onClose} />);
    expect(document.activeElement).toBe(dialog());
    unmount();
    expect(document.activeElement).toBe(opener);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not throw after unmount when the opener is gone', () => {
    const opener = focusedOpener();
    const { unmount } = render(<TestDialog />);
    opener.remove();
    expect(() => unmount()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps the panel scrollable when the window is short and clips the corner rings', () => {
    render(<TestDialog />);
    const panel = screen.getByRole('heading', { name: 'Okno' }).parentElement;
    expect(panel?.className.split(' ')).toEqual(expect.arrayContaining(['max-h-full', 'overflow-y-auto', 'overflow-x-hidden']));
  });
});
