import type { FixtureSlot } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { fixture, tournamentView } from '../test/snapshots';
import { crossCell, highlightedFixtureId } from './cross-table';

function slots(first: string, second: string): [FixtureSlot, FixtureSlot] {
  return [
    { kind: 'player', playerId: first, seed: null },
    { kind: 'player', playerId: second, seed: null },
  ];
}

const finished = fixture({
  id: 'g-1',
  number: 1,
  slots: slots('p1', 'p2'),
  status: 'finished',
  matchId: 'm1',
  result: { legs: [3, 1], winnerId: 'p1', corrected: false },
});
const walkover = fixture({
  id: 'g-2',
  number: 2,
  slots: slots('p3', 'p1'),
  status: 'walkover',
  result: { legs: [0, 3], winnerId: 'p1', corrected: false },
});
const ready = fixture({ id: 'g-3', number: 3, slots: slots('p2', 'p3'), status: 'ready' });

const view = tournamentView({ fixtures: [finished, walkover, ready] });

describe('crossCell', () => {
  it('marks the diagonal as self', () => {
    expect(crossCell(view, 'p1', 'p1')).toEqual({ kind: 'self' });
  });

  it('gives the legs from the row player side', () => {
    expect(crossCell(view, 'p1', 'p2')).toEqual({ kind: 'result', legs: [3, 1], fixture: finished });
  });

  it('reverses the legs when the row player is in slot 1', () => {
    expect(crossCell(view, 'p2', 'p1')).toEqual({ kind: 'result', legs: [1, 3], fixture: finished });
  });

  it('shows the legs of a walkover', () => {
    expect(crossCell(view, 'p1', 'p3')).toEqual({ kind: 'result', legs: [3, 0], fixture: walkover });
    expect(crossCell(view, 'p3', 'p1')).toEqual({ kind: 'result', legs: [0, 3], fixture: walkover });
  });

  it('gives a pending fixture in either order', () => {
    expect(crossCell(view, 'p2', 'p3')).toEqual({ kind: 'pending', fixture: ready });
    expect(crossCell(view, 'p3', 'p2')).toEqual({ kind: 'pending', fixture: ready });
  });

  it('gives none for a pair without a group fixture', () => {
    const playoff = fixture({ id: 'p-f', number: 4, phase: 'playoff', slots: slots('p1', 'p4'), status: 'ready' });
    const withPlayoff = tournamentView({ format: 'group_playoff', fixtures: [finished, playoff] });
    expect(crossCell(withPlayoff, 'p1', 'p4')).toEqual({ kind: 'none' });
    expect(crossCell(withPlayoff, 'p2', 'p3')).toEqual({ kind: 'none' });
  });
});

describe('highlightedFixtureId', () => {
  it('prefers the live fixture over the next one', () => {
    expect(highlightedFixtureId(tournamentView({ liveFixtureId: 'g-2', nextFixtureId: 'g-3' }))).toBe('g-2');
    expect(highlightedFixtureId(tournamentView({ liveFixtureId: null, nextFixtureId: 'g-3' }))).toBe('g-3');
    expect(highlightedFixtureId(tournamentView({ liveFixtureId: null, nextFixtureId: null }))).toBeNull();
  });
});
