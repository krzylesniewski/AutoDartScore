import { describe, expect, it } from 'vitest';
import { checkoutShortcut } from './checkout-shortcut';
import type { ShortcutKeyEvent } from './keypad-shortcut';

function key(value: string, modifiers: Partial<Omit<ShortcutKeyEvent, 'key'>> = {}): ShortcutKeyEvent {
  return { key: value, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

describe('checkoutShortcut', () => {
  it.each([
    ['Enter', 'success'],
    ['1', 'success'],
    ['0', 'failure'],
    ['Backspace', 'undo'],
    ['n', 'skip'],
    ['N', 'skip'],
  ] as const)('maps %s to %s', (value, expected) => {
    expect(checkoutShortcut(key(value))).toBe(expected);
  });

  it.each(['2', '9', ' ', 'b', 'm', 'Escape', 'Tab', 'ArrowDown'])('ignores %s', (value) => {
    expect(checkoutShortcut(key(value))).toBeNull();
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('ignores keys with %s', (modifier) => {
    for (const value of ['Enter', '1', '0', 'Backspace', 'n', 'N']) {
      expect(checkoutShortcut(key(value, { [modifier]: true }))).toBeNull();
    }
  });

  it('keeps Shift+Enter as a success', () => {
    expect(checkoutShortcut(key('Enter', { shiftKey: true }))).toBe('success');
  });
});
