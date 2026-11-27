export const CHECKOUT_HINTS_STORAGE_KEY = 'autoscore.checkoutHints';

// Podpowiedzi zamknięcia są domyślnie włączone, więc tylko zapisane 'off' je wyłącza.
export function readCheckoutHintsEnabled(): boolean {
  try {
    return localStorage.getItem(CHECKOUT_HINTS_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeCheckoutHintsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CHECKOUT_HINTS_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Wybór zostaje tylko do przeładowania strony.
  }
}
