import type { TournamentView } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { computedView, playedResults, tournamentConfig } from '../test/snapshots';
import { placementRows } from './placement-rows';

const MOCKUP = tournamentConfig('group_playoff', 6, { advance: 4, thirdPlaceMatch: true, consolation: true });

// Grupa rozegrana, pierwszy półfinał i pocieszenie zakończone, drugi półfinał trwa przy 1:1.
function mockupView(): TournamentView {
  const group = playedResults(MOCKUP, {}, (entry) => entry.phase === 'group');
  return computedView(MOCKUP, { ...group, 'p-sf-1': [3, 1], 'c-f': [0, 2], 'p-sf-2': [1, 1] });
}

function seedOf(view: TournamentView, fixtureId: string, index: 0 | 1): string {
  const slot = view.fixtures.find((entry) => entry.id === fixtureId)?.slots[index];
  if (slot?.kind !== 'player') {
    throw new Error(`No player in ${fixtureId}`);
  }
  return slot.playerId;
}

describe('placementRows', () => {
  it('shows the known consolation places and the places the remaining matches decide', () => {
    const view = mockupView();
    expect(placementRows(view)).toEqual([
      { place: 1, playerId: null, text: 'rozstrzygnie finał' },
      { place: 2, playerId: null, text: 'rozstrzygnie finał' },
      { place: 3, playerId: null, text: 'rozstrzygnie mecz o 3. miejsce' },
      { place: 4, playerId: null, text: 'rozstrzygnie mecz o 3. miejsce' },
      { place: 5, playerId: seedOf(view, 'c-f', 1), text: 'pocieszenie 2–0' },
      { place: 6, playerId: seedOf(view, 'c-f', 0), text: 'pocieszenie' },
    ]);
  });

  it('drops the pending rows of a decided match', () => {
    const group = playedResults(MOCKUP, {}, (entry) => entry.phase === 'group');
    const view = computedView(MOCKUP, { ...group, 'p-sf-1': [3, 1], 'p-sf-2': [3, 2], 'p-3rd': [2, 1] });
    const rows = placementRows(view);
    expect(rows.map((row) => [row.place, row.text])).toEqual([
      [1, 'rozstrzygnie finał'],
      [2, 'rozstrzygnie finał'],
      [3, 'mecz o 3. miejsce 2–1'],
      [4, 'mecz o 3. miejsce'],
      [5, 'rozstrzygnie pocieszenie'],
      [6, 'rozstrzygnie pocieszenie'],
    ]);
    expect(rows[2]?.playerId).toBe(seedOf(view, 'p-3rd', 0));
  });

  it('gives every player of a finished tournament exactly one row and no pending rows', () => {
    const view = computedView(MOCKUP, playedResults(MOCKUP));
    expect(view.status).toBe('finished');
    const rows = placementRows(view);
    expect(rows.map((row) => row.place)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.every((row) => row.playerId !== null && !row.text.startsWith('rozstrzygnie'))).toBe(true);
    expect(new Set(rows.map((row) => row.playerId)).size).toBe(6);
    expect(rows.map((row) => row.text)).toEqual([
      'finał 4–0',
      'finał',
      'mecz o 3. miejsce 2–0',
      'mecz o 3. miejsce',
      'pocieszenie 2–0',
      'pocieszenie',
    ]);
  });

  it('shares place 3 in a cup without a third place match', () => {
    const config = tournamentConfig('cup', 4);
    const view = computedView(config, { 'p-sf-1': [3, 0], 'p-sf-2': [1, 3] });
    expect(placementRows(view)).toEqual([
      { place: 1, playerId: null, text: 'rozstrzygnie finał' },
      { place: 2, playerId: null, text: 'rozstrzygnie finał' },
      { place: 3, playerId: view.placements[0]?.playerId, text: 'półfinał' },
      { place: 3, playerId: view.placements[1]?.playerId, text: 'półfinał' },
    ]);
    expect(view.placements.map((placement) => placement.place)).toEqual([3, 3]);
  });

  it('names the group as the last match of a player outside the play-off without a consolation', () => {
    const config = tournamentConfig('group_playoff', 5, { advance: 4 });
    const view = computedView(
      config,
      playedResults(config, {}, (entry) => entry.phase === 'group'),
    );
    const fifth = placementRows(view).find((row) => row.place === 5);
    expect(fifth?.text).toMatch(/^faza grupowa/);
  });

  it('leaves the text empty for a player without a decided match', () => {
    const view = computedView(tournamentConfig('cup', 4), {}, { placements: [{ playerId: 'p1', place: 3 }] });
    expect(placementRows(view).find((row) => row.playerId === 'p1')?.text).toBe('');
  });
});
