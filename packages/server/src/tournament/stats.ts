import type { FixtureFact } from '@autoscore/engine';
import type {
  DomainEvent,
  Fixture,
  TournamentLegRecord,
  TournamentRecord,
  TournamentRecords,
  TournamentStats,
  TournamentStatsPlayer,
  TournamentView,
} from '@autoscore/schema';
import type { ReplayedMatch } from '../replay.js';
import { EMPTY_TOTALS, mergeTotals, tallyGame, toStatLine, type PlayerTotals } from '../stats/tally.js';

export interface TournamentStatsSource {
  readonly view: TournamentView;
  readonly replays: ReadonlyMap<string, ReplayedMatch>; // odtworzenia powiązanych meczów po id meczu
  readonly matches: readonly FixtureFact[]; // rozpoczęte mecze w kolejności fixture_started
}

type Score = Pick<TournamentStatsPlayer, 'played' | 'won' | 'lost' | 'legsFor' | 'legsAgainst'>;

const NO_SCORE: Score = { played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0 };

interface FinishedMatch {
  readonly fixture: Fixture;
  readonly matchId: string;
  readonly playerIds: readonly string[]; // w kolejności slotów
  readonly events: readonly DomainEvent[];
}

// Mecze o statusie finished w kolejności fixture_started. Liczy się status widoku, a nie stan meczu,
// bo korekta wygrywa nawet z cofnięciem, które zabrało meczowi zwycięzcę.
function finishedMatches({ view, replays, matches }: TournamentStatsSource): FinishedMatch[] {
  const fixtures = new Map(view.fixtures.map((fixture) => [fixture.id, fixture]));
  const finished: FinishedMatch[] = [];
  for (const { fixtureId, matchId } of matches) {
    const fixture = fixtures.get(fixtureId);
    if (fixture?.status !== 'finished') {
      continue;
    }
    const replay = replays.get(matchId);
    if (replay?.game.type !== 'match') {
      throw new Error(`Corrupt tournament ${view.id}: match ${matchId} of fixture ${fixtureId} is not a loaded 1v1 match`);
    }
    finished.push({ fixture, matchId, playerIds: replay.game.state.config.playerIds, events: replay.events });
  }
  return finished;
}

// Z wyniku meczu, który zawiera już korekty. Walkower to N:0, a wolny los nie ma wyniku.
function scores(view: TournamentView): Map<string, Score> {
  const table = new Map<string, Score>();
  for (const fixture of view.fixtures) {
    if (fixture.result === null) {
      continue;
    }
    const { legs, winnerId } = fixture.result;
    fixture.slots.forEach((slot, index) => {
      if (slot.kind !== 'player') {
        return;
      }
      const [own, other] = index === 0 ? legs : [legs[1], legs[0]];
      const score = table.get(slot.playerId) ?? NO_SCORE;
      const won = winnerId === slot.playerId;
      table.set(slot.playerId, {
        played: score.played + 1,
        won: score.won + (won ? 1 : 0),
        lost: score.lost + (won ? 0 : 1),
        legsFor: score.legsFor + own,
        legsAgainst: score.legsAgainst + other,
      });
    });
  }
  return table;
}

function higher(value: number, record: TournamentRecord | null): boolean {
  return record === null || value > record.value;
}

function lower(value: number, record: TournamentRecord | null): boolean {
  return record === null || value < record.value;
}

// Rekord zmienia się tylko na wartość ściśle lepszą, więc przy remisie zostaje pierwszy osiągnięty.
function records(finished: readonly FinishedMatch[]): TournamentRecords {
  let highestMatchAverage: TournamentRecord | null = null;
  let highestCheckout: TournamentLegRecord | null = null;
  let shortestLeg: TournamentLegRecord | null = null;
  let highestTurn: TournamentLegRecord | null = null;

  for (const { fixture, matchId, playerIds, events } of finished) {
    const fixtureId = fixture.id;
    for (const [slot, value] of (fixture.averages ?? []).entries()) {
      if (higher(value, highestMatchAverage)) {
        highestMatchAverage = { playerId: playerIds[slot] as string, fixtureId, matchId, value };
      }
    }
    for (const event of events) {
      const legRecord = (playerId: string, legIndex: number, value: number) => ({ playerId, fixtureId, matchId, legIndex, value });
      switch (event.type) {
        case 'turn_completed':
          if (higher(event.total, highestTurn)) {
            highestTurn = legRecord(event.playerId, event.legIndex, event.total);
          }
          break;
        case 'leg_won':
          if (higher(event.checkout, highestCheckout)) {
            highestCheckout = legRecord(event.playerId, event.legIndex, event.checkout);
          }
          if (lower(event.dartsThrown, shortestLeg)) {
            shortestLeg = legRecord(event.playerId, event.legIndex, event.dartsThrown);
          }
          break;
        default:
          break;
      }
    }
  }
  return { highestMatchAverage, highestCheckout, shortestLeg, highestTurn };
}

// Jeden wiersz na gracza w kolejności zgłoszenia, także dla gości.
// Rzutki i rekordy liczą się tylko z meczów o statusie finished, także po korekcie wyniku.
export function buildTournamentStats(source: TournamentStatsSource): TournamentStats {
  const { view } = source;
  const finished = finishedMatches(source);
  const totals = new Map<string, PlayerTotals>();
  for (const { playerIds, events } of finished) {
    for (const [playerId, own] of tallyGame('match', playerIds, events).players) {
      totals.set(playerId, mergeTotals(totals.get(playerId) ?? EMPTY_TOTALS, own));
    }
  }

  const table = scores(view);
  const players = view.players.map(({ id }): TournamentStatsPlayer => {
    const line = toStatLine(totals.get(id) ?? EMPTY_TOTALS);
    const score = table.get(id) ?? NO_SCORE;
    return {
      playerId: id,
      ...score,
      legDifference: score.legsFor - score.legsAgainst,
      dartsThrown: line.dartsThrown,
      average: line.average,
      first9Average: line.first9Average,
      scores100: line.scores100,
      scores140: line.scores140,
      scores180: line.scores180,
      highestCheckout: line.highestCheckout,
      bestLegDarts: line.bestLegDarts,
    };
  });
  return { tournamentId: view.id, players, records: records(finished) };
}
