import { describe, expect, it } from 'vitest';
import { keypadShortcut, type ShortcutKeyEvent } from './keypad-shortcut';

function press(key: string, modifiers: Partial<Omit<ShortcutKeyEvent, 'key'>> = {}) {
  return keypadShortcut({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...modifiers });
}

describe('keypadShortcut', () => {
  it('maps Space to a miss', () => {
    expect(press(' ')).toEqual({ kind: 'miss' });
  });

  it.each([
    ['s', 1],
    ['S', 1],
    ['d', 2],
    ['D', 2],
    ['t', 3],
    ['T', 3],
  ] as const)('maps %s to multiplier %i', (key, value) => {
    expect(press(key)).toEqual({ kind: 'multiplier', value });
  });

  it.each(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])('maps %s to a digit', (key) => {
    expect(press(key)).toEqual({ kind: 'digit', digit: Number(key) });
  });

  it.each(['b', 'B'])('maps %s without Shift to 25', (key) => {
    expect(press(key)).toEqual({ kind: 'outerBull' });
  });

  it.each(['b', 'B'])('maps %s with Shift to Bull', (key) => {
    expect(press(key, { shiftKey: true })).toEqual({ kind: 'bull' });
  });

  it('maps Backspace to undo and Enter to enter', () => {
    expect(press('Backspace')).toEqual({ kind: 'undo' });
    expect(press('Enter')).toEqual({ kind: 'enter' });
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('returns null for every key while %s is held', (modifier) => {
    for (const key of [' ', 's', 'd', 't', '1', 'b', 'Backspace', 'Enter']) {
      expect(press(key, { [modifier]: true })).toBeNull();
    }
  });

  it.each(['a', 'x', 'Escape', 'Tab', 'ArrowUp', 'Shift', 'Delete', 'F5', '+', 'Dead'])('returns null for %s', (key) => {
    expect(press(key)).toBeNull();
  });
});
