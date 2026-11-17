import type { FixtureSlot } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { fixture, tournamentView } from '../test/snapshots';
import { tournamentProgress } from './tournament-progress';

const PAIR: [FixtureSlot, FixtureSlot] = [
  { kind: 'player', playerId: 'p1', seed: null },
  { kind: 'player', playerId: 'p2', seed: null },
];

function played(id: string, number: number, phase: 'group' | 'playoff' = 'group') {
  return fixture({
    id,
    number,
    phase,
    slots: PAIR,
    status: 'finished',
    matchId: `m-${id}`,
    result: { legs: [3, 1], winnerId: 'p1', corrected: false },
  });
}

function open(id: string, number: number, phase: 'group' | 'playoff' = 'group') {
  return fixture({ id, number, phase, slots: PAIR, status: 'ready' });
}

function bye(id: string, number: number) {
  return fixture({ id, number, phase: 'playoff', slots: [PAIR[0], { kind: 'bye' }], status: 'bye' });
}

describe('tournamentProgress', () => {
  it('counts every league fixture', () => {
    const view = tournamentView({ fixtures: [played('g-1', 1), open('g-2', 2), open('g-3', 3)] });
    expect(tournamentProgress(view)).toEqual({ phase: 'league', done: 1, total: 3 });
  });

  it('counts a walkover as done', () => {
    const walkover = fixture({ id: 'g-2', number: 2, status: 'walkover', result: { legs: [0, 3], winnerId: 'p2', corrected: false } });
    const view = tournamentView({ fixtures: [played('g-1', 1), walkover, open('g-3', 3)] });
    expect(tournamentProgress(view)).toEqual({ phase: 'league', done: 2, total: 3 });
  });

  it('counts only the group while a group fixture has no result', () => {
    const view = tournamentView({
      format: 'group_playoff',
      fixtures: [played('g-1', 1), open('g-2', 2), fixture({ id: 'p-f', number: 3, phase: 'playoff', status: 'waiting' })],
    });
    expect(tournamentProgress(view)).toEqual({ phase: 'group', done: 1, total: 2 });
  });

  it('moves group and play-off to the play-off once every group fixture has a result', () => {
    const view = tournamentView({
      format: 'group_playoff',
      fixtures: [played('g-1', 1), played('g-2', 2), open('p-sf-1', 3, 'playoff'), open('p-sf-2', 4, 'playoff')],
    });
    expect(tournamentProgress(view)).toEqual({ phase: 'playoff', done: 0, total: 2 });
  });

  it('leaves the byes out of the cup total', () => {
    const view = tournamentView({
      format: 'cup',
      fixtures: [bye('p-sf-1', 1), played('p-sf-2', 2, 'playoff'), open('p-f', 3, 'playoff')],
    });
    expect(tournamentProgress(view)).toEqual({ phase: 'playoff', done: 1, total: 2 });
  });

  it('counts every fixture except byes in a finished tournament', () => {
    const view = tournamentView({
      format: 'group_playoff',
      status: 'finished',
      finishedAt: '2026-11-12T21:00:00.000Z',
      fixtures: [played('g-1', 1), played('g-2', 2), bye('p-sf-1', 3), played('p-f', 4, 'playoff')],
    });
    expect(tournamentProgress(view)).toEqual({ phase: 'finished', done: 3, total: 3 });
  });
});
