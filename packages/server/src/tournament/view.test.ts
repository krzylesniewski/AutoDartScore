import { EngineError } from '@autoscore/engine';
import { TournamentConfig, TournamentView, type Player, type TournamentEvent } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import type { ReplayedMatch } from '../replay.js';
import type { StoredTournament, TournamentLogEntry } from '../store/store.js';
import { buildTournamentView } from './view.js';

const createdAt = '2026-11-17T18:00:00.000Z';

function player(id: string, name: string): Player {
  return { id, name, avatar: null, color: 1, guest: false, archivedAt: null, createdAt };
}

const tournament: StoredTournament = {
  id: 't_test',
  name: 'Liga testowa',
  format: 'league',
  config: TournamentConfig.parse({ name: 'Liga testowa', format: 'league', playerIds: ['p1', 'p2', 'p3'], legsToWin: { group: 1 } }),
  players: [player('p1', 'Anna'), player('p2', 'Bartek'), player('p3', 'Celina')],
  createdAt,
};

function at(minute: number): string {
  return new Date(Date.parse(createdAt) + minute * 60_000).toISOString();
}

function log(...events: TournamentEvent[]): TournamentLogEntry[] {
  return events.map((event, index) => ({ ...event, seq: index + 1, createdAt: at(index + 1) }));
}

// Tylko pola, których używa widok turnieju.
function replay(legsWon: [number, number], finishedAt: string | null): ReplayedMatch {
  return { game: { type: 'match', state: { legsWon } }, finishedAt } as unknown as ReplayedMatch;
}

const draw: TournamentEvent = { type: 'draw', order: ['p1', 'p2', 'p3'] };

function build(entries: TournamentLogEntry[], replays: Record<string, ReplayedMatch> = {}): TournamentView {
  return TournamentView.parse(buildTournamentView({ tournament, log: entries, replays: new Map(Object.entries(replays)) }));
}

describe('buildTournamentView', () => {
  it('takes the last draw, the current sharing and the archive time from the log', () => {
    const view = build(log({ type: 'draw', order: ['p3', 'p2', 'p1'] }, draw, { type: 'sharing_changed', sharing: false }));
    expect(view).toMatchObject({ status: 'in_progress', eventSeq: 3, sharing: false, archivedAt: null, canRedraw: true });
    expect(view.config.sharing).toBe(true);
    expect(view.players).toEqual([
      { id: 'p1', name: 'Anna', avatar: null, color: 1, guest: false },
      { id: 'p2', name: 'Bartek', avatar: null, color: 1, guest: false },
      { id: 'p3', name: 'Celina', avatar: null, color: 1, guest: false },
    ]);
    expect(build(log(draw)).fixtures).toEqual(view.fixtures);
  });

  it('reads the legs of started fixtures in slot order', () => {
    const view = build(log(draw, { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' }), { m1: replay([0, 1], at(10)) });
    expect(view.fixtures.find((fixture) => fixture.id === 'g-1')).toMatchObject({
      status: 'finished',
      matchId: 'm1',
      result: { legs: [0, 1], corrected: false },
      averages: null,
    });
    expect(view.standings.every((row) => row.average === null)).toBe(true);
  });

  it('applies withdrawals and finishes at the latest match or withdrawal', () => {
    const base = build(log(draw));
    const fixture = base.fixtures.find((candidate) => candidate.slots.every((slot) => slot.kind === 'player' && slot.playerId !== 'p3'));
    expect(fixture).toBeDefined();
    const entries = log(
      draw,
      { type: 'fixture_started', fixtureId: fixture?.id ?? '', matchId: 'm1' },
      { type: 'player_withdrawn', playerId: 'p3' },
    );
    const later = build(entries, { m1: replay([1, 0], at(30)) });
    expect(later).toMatchObject({ status: 'finished', finishedAt: at(30) });
    expect(later.fixtures.filter((candidate) => candidate.status === 'walkover')).toHaveLength(2);
    expect(later.standings.find((row) => row.playerId === 'p3')).toMatchObject({ withdrawn: true });

    const earlier = build(entries, { m1: replay([1, 0], at(2)) });
    expect(earlier.finishedAt).toBe(at(3));
  });

  it('applies corrections and falls back to the last log entry when no match finished', () => {
    const fixtures = build(log(draw)).fixtures.map((fixture) => fixture.id);
    const started = fixtures.map((fixtureId, index): TournamentEvent => ({ type: 'fixture_started', fixtureId, matchId: `m${index}` }));
    const corrected = fixtures.map((fixtureId): TournamentEvent => ({ type: 'result_corrected', fixtureId, legs: [1, 0] }));
    const entries = log(draw, ...started, ...corrected, { type: 'archived' });
    const replays = Object.fromEntries(fixtures.map((_, index) => [`m${index}`, replay([0, 0], null)]));
    const view = build(entries, replays);
    expect(view.fixtures.every((fixture) => fixture.status === 'finished' && fixture.result?.corrected)).toBe(true);
    expect(view).toMatchObject({ status: 'finished', finishedAt: at(entries.length), archivedAt: at(entries.length) });
  });

  it('treats a missing draw, a missing match and an engine rejection as a corrupt tournament', () => {
    expect(() => build(log({ type: 'archived' }))).toThrow('Corrupt tournament t_test: the log has no draw');
    expect(() => build(log(draw, { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' }))).toThrow(
      'match m1 of fixture g-1 was not loaded',
    );
    expect(() =>
      build(log(draw, { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' }), {
        m1: { game: { type: 'casual', state: {} } } as unknown as ReplayedMatch,
      }),
    ).toThrow('is not a 1v1 match');

    let thrown: unknown;
    try {
      build(log(draw, { type: 'fixture_started', fixtureId: 'p-f', matchId: 'm1' }), { m1: replay([0, 0], null) });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(EngineError);
    expect((thrown as Error).message).toContain('Corrupt tournament t_test: Unknown fixture p-f');
  });
});
