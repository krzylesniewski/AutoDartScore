import { hitPoints } from '@autoscore/engine';
import { FREQUENT_HITS_LIMIT, MISS_SEGMENT, type FrequentHit, type Hit } from '@autoscore/schema';

// Czysta logika rzędu najczęstszych trafień, bez I/O.
export function buildFrequentHits(darts: readonly Hit[]): FrequentHit[] {
  const counts = new Map<string, FrequentHit>();
  for (const dart of darts) {
    if (dart.segment === MISS_SEGMENT) {
      continue;
    }
    const key = `${dart.segment}:${dart.multiplier}`;
    const counted = counts.get(key);
    counts.set(key, { segment: dart.segment, multiplier: dart.multiplier, count: (counted?.count ?? 0) + 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || hitPoints(b) - hitPoints(a) || a.segment - b.segment)
    .slice(0, FREQUENT_HITS_LIMIT);
}
