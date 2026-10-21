export const DIGIT_WAIT_MS = 1000;

export type PendingDigit = 1 | 2 | null;

export interface TypedDigit {
  numbers: number[];
  pending: PendingDigit;
}

// Tylko 1 i 2 mogą zacząć liczbę dwucyfrową (10-20), więc tylko one czekają na drugą cyfrę.
function firstDigit(digit: number): TypedDigit {
  if (digit === 1 || digit === 2) {
    return { numbers: [], pending: digit };
  }
  if (digit >= 3 && digit <= 9) {
    return { numbers: [digit], pending: null };
  }
  return { numbers: [], pending: null };
}

export function typeDigit(pending: PendingDigit, digit: number): TypedDigit {
  if (pending === 1) {
    return { numbers: [10 + digit], pending: null };
  }
  if (pending === 2) {
    if (digit === 0) {
      return { numbers: [20], pending: null };
    }
    // Nie ma segmentu 21-29, więc 2 idzie od razu, a nowa cyfra zaczyna kolejną liczbę.
    const next = firstDigit(digit);
    return { numbers: [2, ...next.numbers], pending: next.pending };
  }
  return firstDigit(digit);
}
