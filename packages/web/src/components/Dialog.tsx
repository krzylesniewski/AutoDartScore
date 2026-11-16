import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject, type SyntheticEvent } from 'react';
import { CornerRings } from './CornerRings';

export interface DialogProps {
  labelledBy: string;
  describedBy?: string;
  busy?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  onClose(): void;
  children: ReactNode;
}

// Natywny <dialog> otwarty przez showModal() leży w top layer: przeglądarka trzyma w nim fokus i blokuje stronę pod spodem.
export function Dialog({ labelledBy, describedBy, busy = false, initialFocus, className = '', onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Bez onClose w zależnościach, żeby wpisane w miejscu onClose wywołujących nie otwierało okna od nowa.
  // initialFocus to obiekt z useRef wywołującego, więc się nie zmienia.
  useEffect(() => {
    // React czyści ref przed cleanupem, więc element trzeba zapamiętać tutaj.
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && !dialog.contains(active) ? active : null;
    if (!dialog.open) {
      dialog.showModal();
    }
    (initialFocus?.current ?? dialog).focus();
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [initialFocus]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key !== 'Escape') {
      return;
    }
    // Bez tego przeglądarka wysłałaby własne żądanie zamknięcia.
    event.preventDefault();
    if (!busy) {
      onClose();
    }
  }

  function onCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    if (!busy) {
      onClose();
    }
  }

  function onNativeClose(event: SyntheticEvent<HTMLDialogElement>): void {
    const dialog = event.currentTarget;
    // Zdarzenie close przychodzi jako osobne zadanie, także po cleanupie w StrictMode i po odmontowaniu.
    if (dialog.open || !dialog.isConnected) {
      return;
    }
    // Chrome robi powtórne cancel nieodwołalnym, więc w trakcie zapisu okno otwiera się z powrotem.
    if (busy) {
      dialog.showModal();
      return;
    }
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onCancel={onCancel}
      onClose={onNativeClose}
      className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none items-center justify-center border-0 bg-(--color-bg)/80 p-(--space-page) text-(--color-text) outline-none open:flex backdrop:bg-transparent"
    >
      <div
        className={`relative flex max-h-full w-full max-w-160 flex-col overflow-x-hidden overflow-y-auto rounded-(--radius-panel) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-5 pt-6 pb-5 shadow-(--shadow-card) sm:px-8 sm:pt-7.5 sm:pb-7 ${className}`}
      >
        {/* overflow-x-hidden przycina tarczę w rogu, żeby nie dodała przewijania w poziomie. */}
        <CornerRings className="-top-20 -right-20 size-60" />
        {children}
      </div>
    </dialog>
  );
}
