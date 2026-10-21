// Tylko do porównań. Zapisane imię zostaje takie, jak je wpisano.
export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');
}
