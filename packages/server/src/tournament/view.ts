import { computeTournament, EngineError, type FixtureFact, type ResultCorrection } from '@autoscore/engine';
import type { TournamentView } from '@autoscore/schema';
import type { ReplayCache } from '../replay-cache.js';
import type { ReplayedMatch } from '../replay.js';
import type { Store, StoredTournament, TournamentLogEntry } from '../store/store.js';

export interface TournamentSource {
  readonly tournament: StoredTournament;
  readonly log: readonly TournamentLogEntry[];
  readonly replays: ReadonlyMap<string, ReplayedMatch>; // odtworzenia powiązanych meczów po id meczu
}

// Daty ISO w UTC porównują się jak tekst.
function latest(dates: readonly string[]): string | null {
  return dates.reduce<string | null>((max, date) => (max === null || date > max ? date : max), null);
}

function corrupt(tournament: StoredTournament, problem: string): Error {
  return new Error(`Corrupt tournament ${tournament.id}: ${problem}`);
}

function fact(source: TournamentSource, fixtureId: string, matchId: string): FixtureFact {
  const replay = source.replays.get(matchId);
  if (!replay) {
    throw corrupt(source.tournament, `match ${matchId} of fixture ${fixtureId} was not loaded`);
  }
  if (replay.game.type !== 'match') {
    throw corrupt(source.tournament, `match ${matchId} of fixture ${fixtureId} is not a 1v1 match`);
  }
  const [first, second] = replay.game.state.legsWon;
  // Gracze meczu są zapisani w kolejności slotów, więc legsWon jest już w tej kolejności.
  return { fixtureId, matchId, legs: [first, second], scoring: null };
}

// Widoku nie zapisujemy. Każdy odczyt liczy go od nowa z konfiguracji, logu turnieju i legów powiązanych meczów.
export function buildTournamentView(source: TournamentSource): TournamentView {
  const { tournament, log } = source;
  let order: readonly string[] | null = null;
  let sharing = tournament.config.sharing;
  let archivedAt: string | null = null;
  const matches: FixtureFact[] = [];
  const withdrawals: string[] = [];
  const withdrawnAt: string[] = [];
  const corrections: ResultCorrection[] = [];
  for (const entry of log) {
    switch (entry.type) {
      case 'draw':
        order = entry.order;
        break;
      case 'fixture_started':
        matches.push(fact(source, entry.fixtureId, entry.matchId));
        break;
      case 'player_withdrawn':
        withdrawals.push(entry.playerId);
        withdrawnAt.push(entry.createdAt);
        break;
      case 'result_corrected':
        corrections.push({ fixtureId: entry.fixtureId, legs: entry.legs });
        break;
      case 'sharing_changed':
        sharing = entry.sharing;
        break;
      case 'archived':
        archivedAt = entry.createdAt;
        break;
    }
  }
  if (order === null) {
    throw corrupt(tournament, 'the log has no draw');
  }

  let state;
  try {
    state = computeTournament({ config: tournament.config, order, matches, withdrawals, corrections });
  } catch (error) {
    // Zapisane dane przeszły walidację przy zapisie, więc odrzucenie przez silnik to uszkodzony log, a nie błąd klienta.
    if (error instanceof EngineError) {
      throw new Error(`Corrupt tournament ${tournament.id}: ${error.message}`, { cause: error });
    }
    throw error;
  }

  let finishedAt: string | null = null;
  if (state.status === 'finished') {
    const matchFinishes = matches.flatMap(({ matchId }) => source.replays.get(matchId)?.finishedAt ?? []);
    finishedAt = latest([...matchFinishes, ...withdrawnAt]) ?? log.at(-1)?.createdAt ?? tournament.createdAt;
  }

  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    config: tournament.config,
    status: state.status,
    createdAt: tournament.createdAt,
    finishedAt,
    players: tournament.players.map(({ id, name, avatar, color, guest }) => ({ id, name, avatar, color, guest })),
    fixtures: [...state.fixtures],
    standings: [...state.standings],
    nextFixtureId: state.nextFixtureId,
    liveFixtureId: state.liveFixtureId,
    placements: [...state.placements],
    sharing,
    canRedraw: state.canRedraw,
    eventSeq: log.at(-1)?.seq ?? 0,
    archivedAt,
  };
}

export interface LoadedTournament {
  readonly view: TournamentView;
  readonly log: readonly TournamentLogEntry[];
}

// Mecz, którego nie da się wczytać ani odtworzyć, przerywa odczyt. Pominięcie go zmieniłoby wynik turnieju.
export async function loadTournament(
  { store, cache }: { readonly store: Pick<Store, 'loadTournamentLog' | 'listMatches'>; readonly cache: ReplayCache },
  tournament: StoredTournament,
): Promise<LoadedTournament> {
  const log = await store.loadTournamentLog(tournament.id);
  const linked = await cache.many(await store.listMatches({ tournamentId: tournament.id }));
  const replays = new Map(linked.map(({ match, replay }) => [match.id, replay]));
  return { view: buildTournamentView({ tournament, log, replays }), log };
}
