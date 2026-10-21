export const KEYPAD_LAYOUT_STORAGE_KEY = 'autoscore.keypadLayout';

export type KeypadLayout = 'ring' | 'grid';

// Brak wpisu, inna wartość albo niedostępny localStorage oznacza koło.
export function readKeypadLayout(): KeypadLayout {
  try {
    return localStorage.getItem(KEYPAD_LAYOUT_STORAGE_KEY) === 'grid' ? 'grid' : 'ring';
  } catch {
    return 'ring';
  }
}

export function writeKeypadLayout(layout: KeypadLayout): void {
  try {
    localStorage.setItem(KEYPAD_LAYOUT_STORAGE_KEY, layout);
  } catch {
    // Wybór zostaje tylko do przeładowania strony.
  }
}
