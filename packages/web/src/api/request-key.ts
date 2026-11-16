// Klucz zapytania zapisany razem z odpowiedzią. Inny klucz w renderze znaczy, że odpowiedź dotyczy starego zapytania.
export function requestKey(...parts: readonly (string | number | null)[]): string {
  return JSON.stringify(parts);
}
