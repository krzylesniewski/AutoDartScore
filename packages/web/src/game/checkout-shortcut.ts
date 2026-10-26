import type { ShortcutKeyEvent } from './keypad-shortcut';

export type CheckoutShortcut = 'success' | 'failure' | 'undo';

// Ctrl, Cmd i Alt zostają dla przeglądarki i systemu, jak w skrótach klawiatury rzutek.
export function checkoutShortcut(event: ShortcutKeyEvent): CheckoutShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  switch (event.key) {
    case 'Enter':
    case '1':
      return 'success';
    case '0':
      return 'failure';
    case 'Backspace':
      return 'undo';
    default:
      return null;
  }
}
