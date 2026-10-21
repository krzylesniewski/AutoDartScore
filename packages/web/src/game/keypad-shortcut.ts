export type KeypadShortcut =
  | { kind: 'miss' }
  | { kind: 'multiplier'; value: 1 | 2 | 3 }
  | { kind: 'digit'; digit: number }
  | { kind: 'outerBull' }
  | { kind: 'bull' }
  | { kind: 'undo' }
  | { kind: 'enter' };

export type ShortcutKeyEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>;

const MULTIPLIER_KEYS: Readonly<Record<string, 1 | 2 | 3>> = { s: 1, d: 2, t: 3 };

// Ctrl, Cmd i Alt zostają dla przeglądarki i systemu, np. Cmd+R albo Ctrl+D.
export function keypadShortcut(event: ShortcutKeyEvent): KeypadShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  const { key } = event;
  if (key === ' ') {
    return { kind: 'miss' };
  }
  if (key === 'Backspace') {
    return { kind: 'undo' };
  }
  if (key === 'Enter') {
    return { kind: 'enter' };
  }
  if (/^[0-9]$/.test(key)) {
    return { kind: 'digit', digit: Number(key) };
  }
  const letter = key.toLowerCase();
  // Shift, a nie wielkość litery, żeby przy Caps Lock B dalej dawało 25.
  if (letter === 'b') {
    return event.shiftKey ? { kind: 'bull' } : { kind: 'outerBull' };
  }
  const multiplier = MULTIPLIER_KEYS[letter];
  if (multiplier !== undefined) {
    return { kind: 'multiplier', value: multiplier };
  }
  return null;
}
