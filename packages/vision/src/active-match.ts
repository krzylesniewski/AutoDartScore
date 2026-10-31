import type { MatchListItem } from '@autoscore/schema';

// Lista przychodzi od najnowszej. Trening checkoutów nie przyjmuje rzutek, a gracz jest właśnie w nim,
// więc nie wysyłamy lotki do starszej gry.
export function pickActiveMatch(items: readonly MatchListItem[]): MatchListItem | null {
  const newest = items.find((item) => item.status === 'in_progress');
  if (newest === undefined || newest.practiceMode === 'checkouts') {
    return null;
  }
  return newest;
}
