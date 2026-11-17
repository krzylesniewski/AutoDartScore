import { EngineError } from '@autoscore/engine';
import { TournamentConfig, TournamentView, type DomainEvent, type Hit, type Player, type TournamentEvent } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import type { ReplayedMatch } from '../replay.js';
import { threeDartAverage } from '../stats/tally.js';
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

// Tylko pola, których używa widok turnieju. Gracze meczu w kolejności slotów.
function replay(
  legsWon: [number, number],
  finishedAt: string | null,
  playerIds: readonly [string, string] = ['p1', 'p2'],
  events: readonly DomainEvent[] = [],
): ReplayedMatch {
  return { game: { type: 'match', state: { legsWon, config: { playerIds } } }, finishedAt, events } as unknown as ReplayedMatch;
}

const MISSES: Hit[] = [
  { segment: 0, multiplier: 0 },
  { segment: 0, multiplier: 0 },
  { segment: 0, multiplier: 0 },
];

// Tury po trzy rzutki. Średnia bierze tylko sumę tur i liczbę rzutek, więc rzutki nie muszą dawać tej sumy.
function turns(playerId: string, ...totals: number[]): DomainEvent[] {
  return totals.map((total, turnIndex) => ({
    type: 'turn_completed',
    playerId,
    legIndex: 0,
    turnIndex,
    darts: MISSES,
    total,
    remaining: 0,
  }));
}

function bust(playerId: string, darts: number): DomainEvent {
  return { type: 'bust', playerId, legIndex: 0, turnIndex: 0, darts: MISSES.slice(0, darts), remaining: 100 };
}

const draw: TournamentEvent = { type: 'draw', order: ['p1', 'p2', 'p3'] };

function build(entries: TournamentLogEntry[], replays: Record<string, ReplayedMatch> = {}): TournamentView {
  return TournamentView.parse(buildTournamentView({ tournament, log: entries, replays: new Map(Object.entries(replays)) }));
}

// Gracze meczu po losowaniu draw, w kolejności slotów.
function slots(fixtureId: string): [string, string] {
  const fixture = build(log(draw)).fixtures.find((candidate) => candidate.id === fixtureId);
  const [first, second] = fixture?.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : '')) ?? [];
  return [first ?? '', second ?? ''];
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

  it('reads the legs and averages of started fixtures in slot order', () => {
    const [first, second] = slots('g-1');
    const events = [...turns(first, 0), ...turns(second, 180, 121), bust(first, 1)];
    const view = build(log(draw, { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' }), {
      m1: replay([0, 1], at(10), [first, second], events),
    });
    expect(view.fixtures.find((fixture) => fixture.id === 'g-1')).toMatchObject({
      status: 'finished',
      matchId: 'm1',
      result: { legs: [0, 1], corrected: false },
      averages: [0, 150.5],
    });
    expect(view.standings.find((row) => row.playerId === first)?.average).toBe(0);
    expect(view.standings.find((row) => row.playerId === second)?.average).toBe(150.5);
    expect(view.standings.filter((row) => row.average === null)).toHaveLength(1);
  });

  it('keeps averages out of a fixture in progress', () => {
    const [first, second] = slots('g-1');
    const view = build(log(draw, { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' }), {
      m1: replay([0, 0], null, [first, second], [...turns(first, 60), ...turns(second, 45)]),
    });
    expect(view.fixtures.find((fixture) => fixture.id === 'g-1')).toMatchObject({ status: 'in_progress', averages: null });
    expect(view.standings.every((row) => row.average === null)).toBe(true);
  });

  it('averages the summed points and darts of all group matches of a player', () => {
    const both = slots('g-1').find((playerId) => slots('g-2').includes(playerId)) ?? '';
    const replayOf = (fixtureId: string, own: DomainEvent[]) => {
      const pair = slots(fixtureId);
      const other = pair.find((playerId) => playerId !== both) ?? '';
      return replay(pair[0] === both ? [1, 0] : [0, 1], at(10), pair, [...own, ...turns(other, 26)]);
    };
    const entries = log(
      draw,
      { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' },
      { type: 'fixture_started', fixtureId: 'g-2', matchId: 'm2' },
    );
    const view = build(entries, {
      m1: replayOf('g-1', turns(both, 100, 100, 101)),
      m2: replayOf('g-2', [...turns(both, 60), bust(both, 2)]),
    });
    expect(threeDartAverage(361, 14)).toBe(77.36);
    expect(view.standings.find((row) => row.playerId === both)).toMatchObject({ played: 2, won: 2, average: threeDartAverage(361, 14) });
  });

  it('keeps averages out of a walkover that has a match', () => {
    const [first, second] = slots('g-1');
    const entries = log(draw, { type: 'fixture_started', fixtureId: 'g-1', matchId: 'm1' }, { type: 'player_withdrawn', playerId: second });
    const view = build(entries, { m1: replay([0, 0], null, [first, second], [...turns(first, 140), ...turns(second, 100)]) });
    expect(view.fixtures.find((fixture) => fixture.id === 'g-1')).toMatchObject({ status: 'walkover', matchId: 'm1', averages: null });
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
