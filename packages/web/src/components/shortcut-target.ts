const TEXT_FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(', ');

// Atrybut mają sekcja klawiatury rzutek i przyciski „Końcówek”. Na ich kontrolkach Spacja i Enter zostają skrótami, bo inaczej kliknęłyby je drugi raz.
export const SHORTCUT_KEYS = '[data-shortcut-keys]';

// Natywny <dialog> ma rolę dialog bez atrybutu role, więc otwarte okno rozpoznaje atrybut open.
export const OPEN_DIALOG = 'dialog[open]';

export function isTextField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TEXT_FIELD) !== null;
}

export function isOtherControl(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null && target.closest(SHORTCUT_KEYS) === null;
}
