export const TOKEN_STORAGE_KEY = 'autoscore.token';
export const UNAUTHORIZED_EVENT = 'autoscore:unauthorized';

// Zapas na niedostępny localStorage: logowanie działa do przeładowania strony.
let memoryToken: string | null = null;

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return memoryToken;
  }
}

export function saveToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Token zostaje tylko w pamięci.
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nie ma czego usuwać poza pamięcią.
  }
}

export function onUnauthorized(listener: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, listener);
}

// Inny token oznacza, że użytkownik zalogował się po wysłaniu żądania. Spóźnione 401 nie może skasować nowego tokenu.
export function handleUnauthorized(sentToken: string | null): void {
  if (readToken() !== sentToken) {
    return;
  }
  clearToken();
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}
