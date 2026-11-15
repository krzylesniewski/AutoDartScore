import { useEffect, useLayoutEffect, useRef } from 'react';
import { checkoutShortcut } from '../game/checkout-shortcut';
import { isOtherControl, isTextField } from './shortcut-target';

export interface CheckoutShortcutOptions {
  enabled: boolean;
  skipEnabled: boolean;
  undoEnabled: boolean;
  onSuccess(): void;
  onFailure(): void;
  onSkip(): void;
  onUndo(): void;
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
      // Klawisz bez akcji zostaje dla przeglądarki, żeby Backspace i Enter na linku albo przycisku działały jak zwykle.
      if (
        !shortcut ||
        (shortcut === 'skip' && !current.skipEnabled) ||
        (shortcut === 'undo' && !current.undoEnabled) ||
        isTextField(event.target) ||
        document.querySelector('[role="dialog"]')
      ) {
        return;
      }
      if (event.key === 'Enter' && isOtherControl(event.target)) {
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
        case 'skip':
          current.onSkip();
          return;
        case 'undo':
          current.onUndo();
          return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
