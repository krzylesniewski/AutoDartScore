import { describe, expect, it } from 'vitest';
import { computedView, playedResults, tournamentConfig, type ResultLegs } from '../test/snapshots';
import { TV_BRACKET_ROWS, tvBracketRows } from './tv-bracket-rows';

const CUP_16 = tournamentConfig('cup', 16);

const FIRST_FOUR: ResultLegs = { 'p-r16-1': [3, 0], 'p-r16-2': [3, 0], 'p-r16-3': [3, 0], 'p-r16-4': [3, 0] };

function numbers(rows: readonly { number: number }[]): number[] {
  return rows.map((row) => row.number);
}

describe('tvBracketRows', () => {
  it('shows six rows', () => {
    expect(TV_BRACKET_ROWS).toBe(6);
  });

  it('returns every play-off fixture of a short bracket, without the group', () => {
    const view = computedView(tournamentConfig('group_playoff', 6, { advance: 4, thirdPlaceMatch: true }));
    expect(tvBracketRows(view).map((row) => row.id)).toEqual(['p-sf-1', 'p-sf-2', 'p-3rd', 'p-f']);
  });

  it('leaves byes out', () => {
    const view = computedView(tournamentConfig('cup', 6));
    const rows = tvBracketRows(view);
    expect(rows.some((row) => row.status === 'bye')).toBe(false);
    expect(rows.length).toBeLessThanOrEqual(TV_BRACKET_ROWS);
  });

  it('starts two rows before the live fixture of a 16-player cup', () => {
    const view = computedView(CUP_16, { ...FIRST_FOUR, 'p-r16-5': [1, 0] });
    expect(view.liveFixtureId).toBe('p-r16-5');
    expect(numbers(tvBracketRows(view))).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('starts at the first row when the live fixture is near the top', () => {
    const view = computedView(CUP_16, { 'p-r16-1': [1, 0] });
    expect(numbers(tvBracketRows(view))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('anchors on the next fixture without a live one', () => {
    const view = computedView(
      CUP_16,
      playedResults(CUP_16, {}, (entry) => entry.bracketRound === 'r16' || entry.id === 'p-qf-1'),
    );
    expect(view.liveFixtureId).toBeNull();
    expect(view.nextFixtureId).toBe('p-qf-2');
    expect(numbers(tvBracketRows(view))).toEqual([8, 9, 10, 11, 12, 13]);
  });

  it('anchors on the first fixture without a result without a live and a next fixture', () => {
    const view = computedView(CUP_16, FIRST_FOUR, { liveFixtureId: null, nextFixtureId: null });
    expect(numbers(tvBracketRows(view))).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('shows the last six rows of a finished tournament', () => {
    const view = computedView(CUP_16, playedResults(CUP_16));
    expect(view.status).toBe('finished');
    expect(numbers(tvBracketRows(view))).toEqual([10, 11, 12, 13, 14, 15]);
  });
});
