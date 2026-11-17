import { replayGame } from '@autoscore/engine';
import { TournamentConfig, TournamentStats, type Hit, type Player, type TournamentEvent } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import type { ReplayedMatch } from '../replay.js';
import type { StoredTournament, TournamentLogEntry } from '../store/store.js';
import { buildTournamentStats } from './stats.js';
import { buildTournamentView, tournamentInput } from './view.js';

const createdAt = '2026-11-17T18:00:00.000Z';

function player(id: string, name: string, guest = false): Player {
  return { id, name, avatar: null, color: 1, guest, archivedAt: null, createdAt };
}

const tournament: StoredTournament = {
  id: 't_test',
  name: 'Liga testowa',
  format: 'league',
  config: TournamentConfig.parse({ name: 'Liga testowa', format: 'league', playerIds: ['p1', 'p2', 'p3'], legsToWin: { group: 1 } }),
  players: [player('p1', 'Anna'), player('p2', 'Bartek'), player('p3', 'Gość', true)],
  createdAt,
};

const S = (segment: number): Hit => ({ segment, multiplier: 1 });
const D = (segment: number): Hit => ({ segment, multiplier: 2 });
const T = (segment: number): Hit => ({ segment, multiplier: 3 });
const MISS = { segment: 0, multiplier: 0 } as Hit;

// Gracz ze slotu 0 kończy 301 w drugiej turze (180, potem 121), gracz ze slotu 1 pudłuje.
const LEG: readonly Hit[] = [T(20), T(20), T(20), MISS, MISS, MISS, T(20), T(17), D(5)];

const draw: TournamentEvent = { type: 'draw', order: ['p1', 'p2', 'p3'] };

function log(...events: TournamentEvent[]): TournamentLogEntry[] {
  return events.map((event, index) => ({ ...event, seq: index + 1, createdAt }));
}

function started(fixtureId: string): TournamentEvent {
  return { type: 'fixture_started', fixtureId, matchId: `m-${fixtureId}` };
}

// Gracze meczu po losowaniu draw, w kolejności slotów.
function slots(fixtureId: string): [string, string] {
  const view = buildTournamentView({ tournament, log: log(draw), replays: new Map() });
  const fixture = view.fixtures.find((candidate) => candidate.id === fixtureId);
  const [first, second] = fixture?.slots.map((slot) => (slot.kind === 'player' ? slot.playerId : '')) ?? [];
  return [first ?? '', second ?? ''];
}

// Odtworzenie meczu w silniku. Widok i statystyki czytają tylko stan gry, zdarzenia i czas końca.
// Domyślnie zaczyna gracz ze slotu 0. starter wskazuje innego gracza, który rzuca pierwszy.
function played(fixtureId: string, hits: readonly Hit[], starter?: string): [string, ReplayedMatch] {
  const playerIds = slots(fixtureId);
  const firstPlayerIndex = starter === playerIds[1] ? 1 : 0;
  const { state, events } = replayGame({ type: 'match', playerIds, startingScore: 301, legsToWin: 1, firstPlayerIndex }, hits);
  return [`m-${fixtureId}`, { game: state, events, finishedAt: null } as unknown as ReplayedMatch];
}

function stats(entries: TournamentLogEntry[], replays: [string, ReplayedMatch][]): TournamentStats {
  const source = { tournament, log: entries, replays: new Map(replays) };
  const view = buildTournamentView(source);
  return TournamentStats.parse(buildTournamentStats({ view, replays: source.replays, matches: tournamentInput(source).matches }));
}

const NO_RECORDS = { highestMatchAverage: null, highestCheckout: null, shortestLeg: null, highestTurn: null };

describe('buildTournamentStats', () => {
  it('gives every player, guests included, an empty row and no records before any match', () => {
    const result = stats(log(draw), []);
    expect(result.tournamentId).toBe('t_test');
    expect(result.players.map((row) => row.playerId)).toEqual(['p1', 'p2', 'p3']);
    expect(result.players[2]).toEqual({
      playerId: 'p3',
      played: 0,
      won: 0,
      lost: 0,
      legsFor: 0,
      legsAgainst: 0,
      legDifference: 0,
      dartsThrown: 0,
      average: null,
      first9Average: null,
      scores100: 0,
      scores140: 0,
      scores180: 0,
      highestCheckout: null,
      bestLegDarts: null,
    });
    expect(result.records).toEqual(NO_RECORDS);
  });

  it('counts the throws of finished matches and points every record to the first-started match on a tie', () => {
    const result = stats(log(draw, started('g-2'), started('g-1')), [played('g-1', LEG), played('g-2', LEG)]);
    const [winner] = slots('g-2');
    const record = { playerId: winner, fixtureId: 'g-2', matchId: 'm-g-2' };
    expect(result.records).toEqual({
      highestMatchAverage: { ...record, value: 150.5 },
      highestCheckout: { ...record, legIndex: 0, value: 121 },
      shortestLeg: { ...record, legIndex: 0, value: 6 },
      highestTurn: { ...record, legIndex: 0, value: 180 },
    });
    for (const fixtureId of ['g-1', 'g-2']) {
      const [first, second] = slots(fixtureId);
      expect(result.players.find((row) => row.playerId === first)).toMatchObject({ scores180: 1, highestCheckout: 121, bestLegDarts: 6 });
      expect(result.players.find((row) => row.playerId === second)).toMatchObject({ scores180: 0, highestCheckout: null });
    }
  });

  it('sums the throws of two matches with the turn buckets of the stat line', () => {
    const first = slots('g-1').find((playerId) => slots('g-2').includes(playerId)) ?? '';
    const second = slots('g-1').find((playerId) => playerId !== first);
    const other = slots('g-2').find((playerId) => playerId !== first);
    // 140, 120 i zamknięcie 41 w 9 rzutkach, potem 180 i zamknięcie 121 w 6 rzutkach.
    const g1: Hit[] = [T(20), T(20), S(20), MISS, MISS, MISS, T(20), T(20), MISS, MISS, MISS, MISS, S(1), MISS, D(20)];
    const g2: Hit[] = [T(20), T(20), T(20), S(1), MISS, MISS, T(20), T(17), D(5)];
    const result = stats(log(draw, started('g-1'), started('g-2')), [played('g-1', g1, first), played('g-2', g2, first)]);
    expect(result.players.find((row) => row.playerId === first)).toEqual({
      playerId: first,
      played: 2,
      won: 2,
      lost: 0,
      legsFor: 2,
      legsAgainst: 0,
      legDifference: 2,
      dartsThrown: 15,
      average: 120.4,
      first9Average: 120.4,
      scores100: 2,
      scores140: 1,
      scores180: 1,
      highestCheckout: 121,
      bestLegDarts: 6,
    });
    expect(result.players.find((row) => row.playerId === second)).toMatchObject({ played: 1, lost: 1, dartsThrown: 6, average: 0 });
    expect(result.players.find((row) => row.playerId === other)).toMatchObject({ played: 1, lost: 1, dartsThrown: 3, average: 1 });
    expect(result.records).toEqual({
      highestMatchAverage: { playerId: first, fixtureId: 'g-2', matchId: 'm-g-2', value: 150.5 },
      highestCheckout: { playerId: first, fixtureId: 'g-2', matchId: 'm-g-2', legIndex: 0, value: 121 },
      shortestLeg: { playerId: first, fixtureId: 'g-2', matchId: 'm-g-2', legIndex: 0, value: 6 },
      highestTurn: { playerId: first, fixtureId: 'g-2', matchId: 'm-g-2', legIndex: 0, value: 180 },
    });
  });

  it('takes wins and legs from corrections and walkovers but keeps the throws of a corrected match', () => {
    const [first, second] = slots('g-1');
    const entries = log(
      draw,
      started('g-1'),
      { type: 'result_corrected', fixtureId: 'g-1', legs: [0, 1] },
      { type: 'player_withdrawn', playerId: first },
    );
    const result = stats(entries, [played('g-1', LEG)]);
    expect(result.players.find((row) => row.playerId === first)).toMatchObject({
      played: 2,
      won: 0,
      lost: 2,
      legsFor: 0,
      legsAgainst: 2,
      legDifference: -2,
      dartsThrown: 6,
      average: 150.5,
      scores180: 1,
    });
    expect(result.players.find((row) => row.playerId === second)).toMatchObject({ played: 1, won: 1, legsFor: 1, dartsThrown: 3 });
    const third = ['p1', 'p2', 'p3'].find((id) => id !== first && id !== second);
    expect(result.players.find((row) => row.playerId === third)).toMatchObject({ played: 1, won: 1, legsFor: 1, dartsThrown: 0 });
    expect(result.records.highestTurn).toMatchObject({ playerId: first, fixtureId: 'g-1', value: 180 });
  });

  it('ignores the throws of a match in progress and of a walkover with a match', () => {
    const partial: Hit[] = [T(20), T(20), T(20), MISS, MISS, MISS];
    const running = stats(log(draw, started('g-1')), [played('g-1', partial)]);
    expect(running.players.every((row) => row.dartsThrown === 0 && row.played === 0)).toBe(true);
    expect(running.records).toEqual(NO_RECORDS);

    const [first, second] = slots('g-1');
    const walkover = stats(log(draw, started('g-1'), { type: 'player_withdrawn', playerId: second }), [played('g-1', partial)]);
    expect(walkover.players.find((row) => row.playerId === first)).toMatchObject({ won: 1, legsFor: 1, dartsThrown: 0, scores180: 0 });
    expect(walkover.records).toEqual(NO_RECORDS);
  });

  it('treats a finished fixture without its replay as a corrupt tournament', () => {
    const source = { tournament, log: log(draw, started('g-1')), replays: new Map([played('g-1', LEG)]) };
    const view = buildTournamentView(source);
    const { matches } = tournamentInput(source);
    expect(() => buildTournamentStats({ view, replays: new Map(), matches })).toThrow(
      'Corrupt tournament t_test: match m-g-1 of fixture g-1',
    );
  });
});
