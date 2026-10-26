import { useEffect, useLayoutEffect, useRef } from 'react';
import { checkoutShortcut } from '../game/checkout-shortcut';

export interface CheckoutShortcutOptions {
  enabled: boolean;
  undoEnabled: boolean;
  onSuccess(): void;
  onFailure(): void;
  onUndo(): void;
}

const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isTextField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TEXT_FIELD) !== null;
}

// Klawiatura rzutek nie jest w tym trybie wyrenderowana, więc jej skróty nie dublują tych.
export function useCheckoutShortcuts(options: CheckoutShortcutOptions): void {
  // Nasłuch jest jeden na cały czas życia, więc czyta najnowsze opcje z refa, a nie z domknięcia.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const current = latest.current;
      if (!current.enabled || event.defaultPrevented || event.isComposing) {
        return;
      }
      const shortcut = checkoutShortcut(event);
      if (!shortcut || isTextField(event.target) || document.querySelector('[role="dialog"]')) {
        return;
      }
      // Enter na przycisku z fokusem kliknąłby go drugi raz.
      event.preventDefault();
      // Przytrzymany klawisz nie może zapisać serii prób ani cofnąć kilku.
      if (event.repeat) {
        return;
      }
      switch (shortcut) {
        case 'success':
          current.onSuccess();
          return;
        case 'failure':
          current.onFailure();
          return;
        case 'undo':
          if (current.undoEnabled) {
            current.onUndo();
          }
          return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
