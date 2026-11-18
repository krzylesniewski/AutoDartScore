import type { Fixture, PublicTournamentView } from '@autoscore/schema';

export const TV_BRACKET_ROWS = 6;

function anchorIndex(view: PublicTournamentView, rows: readonly Fixture[]): number {
  for (const id of [view.liveFixtureId, view.nextFixtureId]) {
    const index = rows.findIndex((fixture) => fixture.id === id);
    if (id !== null && index !== -1) {
      return index;
    }
  }
  const open = rows.findIndex((fixture) => fixture.result === null);
  return open === -1 ? rows.length - 1 : open;
}

// Lista play-off na TV ma stałą wysokość, więc pokazuje okno meczów wokół trwającego (dwa przed nim), a bez niego wokół najbliższego.
export function tvBracketRows(view: PublicTournamentView): Fixture[] {
  const rows = view.fixtures
    .filter((fixture) => fixture.phase !== 'group' && fixture.status !== 'bye')
    .sort((first, second) => first.number - second.number);
  if (rows.length <= TV_BRACKET_ROWS) {
    return rows;
  }
  const start = Math.min(Math.max(anchorIndex(view, rows) - 2, 0), rows.length - TV_BRACKET_ROWS);
  return rows.slice(start, start + TV_BRACKET_ROWS);
}
