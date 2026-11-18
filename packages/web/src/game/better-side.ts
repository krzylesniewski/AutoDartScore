// Która strona porównania ma lepszą wartość. Wartość wygrywa z brakiem wartości, a remis nie ma lepszej strony.
export function betterSide(first: number | null, second: number | null, lowerIsBetter: boolean): 0 | 1 | null {
  if (first === null && second === null) {
    return null;
  }
  if (first === null) {
    return 1;
  }
  if (second === null) {
    return 0;
  }
  if (first === second) {
    return null;
  }
  return first < second === lowerIsBetter ? 0 : 1;
}
