import { useEffect, useLayoutEffect, useRef } from 'react';
import { keypadShortcut } from '../game/keypad-shortcut';
import { DIGIT_WAIT_MS, typeDigit, type PendingDigit } from '../game/shortcut-number';

export interface KeypadShortcutOptions {
  enabled: boolean;
  undoEnabled: boolean;
  onMiss(): void;
  onMultiplier(value: 1 | 2 | 3): void;
  onNumber(segment: number): void;
  onOuterBull(): void;
  onBull(): void;
  onUndo(): void;
  onEnterCheckout(): void;
}

const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isTextField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TEXT_FIELD) !== null;
}

export function useKeypadShortcuts(options: KeypadShortcutOptions): void {
  // Nasłuch jest jeden na cały czas życia, więc czyta najnowsze opcje z refa, a nie z domknięcia.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });

  const pending = useRef<PendingDigit>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function dropPending(): void {
      pending.current = null;
      clearTimeout(timer.current);
    }

    function commitPending(): void {
      const digit = pending.current;
      dropPending();
      if (digit !== null) {
        latest.current.onNumber(digit);
      }
    }

    function typeNumber(digit: number): void {
      const typed = typeDigit(pending.current, digit);
      pending.current = typed.pending;
      clearTimeout(timer.current);
      if (typed.pending !== null) {
        timer.current = setTimeout(commitPending, DIGIT_WAIT_MS);
      }
      for (const segment of typed.numbers) {
        latest.current.onNumber(segment);
      }
    }

    // Niektóre przeglądarki klikają przycisk z fokusem dopiero przy puszczeniu spacji.
    let spaceHandled = false;

    function onKeyDown(event: KeyboardEvent): void {
      const current = latest.current;
      if (!current.enabled || event.defaultPrevented || event.isComposing) {
        return;
      }
      const shortcut = keypadShortcut(event);
      if (!shortcut || isTextField(event.target) || document.querySelector('[role="dialog"]')) {
        return;
      }
      // Także przy fokusie na klawiszu, żeby Spacja i Enter nie klikały go drugi raz, a Spacja nie przewijała strony.
      event.preventDefault();
      if (event.key === ' ') {
        spaceHandled = true;
      }
      // Przytrzymany klawisz nie może wpisać serii rzutek ani cofnąć kilku.
      if (event.repeat) {
        return;
      }

      switch (shortcut.kind) {
        case 'digit':
          typeNumber(shortcut.digit);
          return;
        case 'enter':
          if (pending.current !== null) {
            commitPending();
          } else {
            current.onEnterCheckout();
          }
          return;
        case 'multiplier':
          current.onMultiplier(shortcut.value);
          return;
        case 'undo':
          if (pending.current !== null) {
            dropPending();
          } else if (current.undoEnabled) {
            current.onUndo();
          }
          return;
        case 'miss':
          commitPending();
          current.onMiss();
          return;
        case 'outerBull':
          commitPending();
          current.onOuterBull();
          return;
        case 'bull':
          commitPending();
          current.onBull();
          return;
      }
    }

    function onKeyUp(event: KeyboardEvent): void {
      if (event.key === ' ' && spaceHandled) {
        spaceHandled = false;
        event.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      dropPending();
    };
  }, []);

  useEffect(() => {
    if (!options.enabled) {
      pending.current = null;
      clearTimeout(timer.current);
    }
  }, [options.enabled]);
}
