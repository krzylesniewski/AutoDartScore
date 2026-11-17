// Fisher-Yates. min chroni przed random() zwracającym wartość tak bliską 1, że iloczyn zaokrągla się do i + 1.
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(Math.floor(random() * (i + 1)), i);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
