import { describe, expect, it } from 'vitest';
import { groupHistoryByDay } from './history-days';

const now = new Date(2026, 9, 18, 19, 30);

function game(id: string, year: number, month: number, day: number, hour = 12): { id: string; updatedAt: string } {
  return { id, updatedAt: new Date(year, month, day, hour).toISOString() };
}

describe('groupHistoryByDay', () => {
  it('returns no groups for no games', () => {
    expect(groupHistoryByDay([], now)).toEqual([]);
  });

  it('puts the games of one day into one group', () => {
    const games = [game('a', 2026, 9, 18, 18), game('b', 2026, 9, 18, 9)];
    expect(groupHistoryByDay(games, now)).toEqual([{ key: '2026-10-18-0', label: 'Dziś', games }]);
  });

  it('keeps two days in the server order', () => {
    const today = game('a', 2026, 9, 18);
    const yesterday = game('b', 2026, 9, 17);
    expect(groupHistoryByDay([today, yesterday], now)).toEqual([
      { key: '2026-10-18-0', label: 'Dziś', games: [today] },
      { key: '2026-10-17-1', label: 'Wczoraj', games: [yesterday] },
    ]);
  });

  it('starts a new group when a day repeats after another day', () => {
    const groups = groupHistoryByDay([game('a', 2026, 9, 18), game('b', 2026, 9, 16), game('c', 2026, 9, 18)], now);
    expect(groups.map((group) => group.label)).toEqual(['Dziś', '16.10', 'Dziś']);
    expect(groups.map((group) => group.key)).toEqual(['2026-10-18-0', '2026-10-16-1', '2026-10-18-2']);
    expect(groups.map((group) => group.games.map((item) => item.id))).toEqual([['a'], ['b'], ['c']]);
  });

  it('keeps the order of the games inside a group without sorting', () => {
    const games = [game('a', 2026, 9, 18, 9), game('b', 2026, 9, 18, 18), game('c', 2026, 9, 18, 12)];
    expect(groupHistoryByDay(games, now)[0]?.games.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});
