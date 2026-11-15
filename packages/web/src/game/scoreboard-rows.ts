export type ScoreboardRowKind = 'current' | 'waiting' | 'placed' | 'slot';

const KINDS: readonly ScoreboardRowKind[] = ['current', 'waiting', 'placed', 'slot'];

// Zawsze wszystkie cztery składniki w tej samej kolejności, żeby przeglądarka płynnie przechodziła między dwoma calc().
function sum(kinds: readonly ScoreboardRowKind[]): string {
  const terms = KINDS.map((kind) => `var(--row-${kind}) * ${kinds.filter((other) => other === kind).length}`);
  return `calc(${terms.join(' + ')})`;
}

// Przesunięcie wiersza to suma wysokości wierszy nad nim, bo karta rzucającego jest wyższa od pozostałych.
export function scoreboardRowOffsets(kinds: readonly ScoreboardRowKind[]): { offsets: string[]; height: string } {
  return {
    offsets: kinds.map((_, index) => sum(kinds.slice(0, index))),
    height: sum(kinds),
  };
}
