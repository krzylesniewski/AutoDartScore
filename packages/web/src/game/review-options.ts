import type { ReviewCandidate, ReviewedThrow } from '@autoscore/schema';

// Kandydaci inni niż bieżący odczyt, od najbardziej prawdopodobnego. Sortowanie jest stabilne, więc remisy zostają w kolejności detektora.
export function reviewOptions(entry: ReviewedThrow): readonly ReviewCandidate[] {
  const candidates = entry.review?.candidates ?? [];
  return candidates
    .filter((candidate) => candidate.segment !== entry.value.segment || candidate.multiplier !== entry.value.multiplier)
    .sort((a, b) => b.probability - a.probability);
}
