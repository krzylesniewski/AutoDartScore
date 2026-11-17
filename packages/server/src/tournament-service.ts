import { computeTournament, countsToStats, createGame } from '@autoscore/engine';
import type {
  CreateTournamentRequest,
  Fixture,
  StartFixtureResult,
  TournamentListItem,
  TournamentListQuery,
  TournamentLiveMessage,
  TournamentView,
} from '@autoscore/schema';
import { HttpError, notFound, TournamentStaleStateHttpError } from './errors.js';
import { sendTo, type LiveHub, type LiveSocket } from './live-hub.js';
import type { ReplayCache } from './replay-cache.js';
import { gameConfig } from './replay.js';
import type { SerialQueue } from './serial-queue.js';
import type { NewMatch, Store, StoredMatch, StoredTournament } from './store/store.js';
import { shuffle } from './tournament/shuffle.js';
import { loadTournament, type LoadedTournament } from './tournament/view.js';

// expectedSeq w komendach jest opcjonalne, jak w komendach gry. Porównujemy je z eventSeq widoku, czyli najwyższym seq logu turnieju.
export interface TournamentService {
  create(request: CreateTournamentRequest): Promise<TournamentView>;
  list(query: TournamentListQuery): Promise<TournamentListItem[]>;
  get(id: string): Promise<TournamentView>;
  draw(id: string, expectedSeq?: number): Promise<TournamentView>;
  startFixture(id: string, fixtureId: string, expectedSeq?: number): Promise<{ statusCode: 200 | 201; result: StartFixtureResult }>;
  archive(id: string, expectedSeq?: number): Promise<TournamentView>;
  // Po zmianie legów w meczu turnieju. Rozsyła świeży widok.
  matchLegsChanged(match: StoredMatch): Promise<void>;
  // null, gdy turnieju nie ma. Inaczej funkcja do wypisania gniazda.
  subscribe(id: string, socket: LiveSocket): Promise<(() => void) | null>;
}

interface Dependencies {
  readonly store: Store;
  readonly cache: ReplayCache;
  readonly hub: LiveHub<TournamentLiveMessage>;
  readonly queue: SerialQueue;
  readonly random: () => number;
}

// Jeden klucz dla wszystkich utworzeń, żeby dwa równoległe nie przeszły razem sprawdzenia aktywnego turnieju.
const CREATE_KEY = 'tournament:create';

function queueKey(id: string): string {
  return `tournament:${id}`;
}

export function createTournamentService({ store, cache, hub, queue, random }: Dependencies): TournamentService {
  async function requireTournament(id: string): Promise<StoredTournament> {
    const tournament = await store.findTournament(id);
    if (!tournament) {
      throw notFound(`Tournament ${id}`);
    }
    return tournament;
  }

  function load(tournament: StoredTournament): Promise<LoadedTournament> {
    return loadTournament({ store, cache }, tournament);
  }

  async function view(tournament: StoredTournament): Promise<TournamentView> {
    return (await load(tournament)).view;
  }

  function requireSeq(view: TournamentView, expectedSeq: number | undefined): void {
    if (expectedSeq !== undefined && expectedSeq !== view.eventSeq) {
      throw new TournamentStaleStateHttpError(view.id, expectedSeq, view);
    }
  }

  function requireNotArchived(view: TournamentView): void {
    if (view.archivedAt !== null) {
      throw new HttpError(409, 'tournament_archived', `Tournament ${view.id} is archived`);
    }
  }

  function publish(view: TournamentView): void {
    hub.publish(view.id, [{ type: 'tournament_updated', tournamentId: view.id, eventSeq: view.eventSeq, tournament: view }]);
  }

  async function publishFresh(tournament: StoredTournament): Promise<TournamentView> {
    const fresh = await view(tournament);
    publish(fresh);
    return fresh;
  }

  // Jak losowanie, kto zaczyna, w match-service.ts.
  function drawStarter(playerCount: number): number {
    return Math.min(Math.floor(random() * playerCount), playerCount - 1);
  }

  function fixtureMatch(tournament: StoredTournament, fixture: Fixture): NewMatch {
    const [first, second] = fixture.slots;
    if (first.kind !== 'player' || second.kind !== 'player') {
      throw new Error(`Fixture ${fixture.id} of tournament ${tournament.id} is ready without two players`);
    }
    // Gracze meczu w kolejności slotów. Na tym opiera się odczyt legów w widoku turnieju.
    const playerIds = [first.playerId, second.playerId];
    const players = playerIds.flatMap((playerId) => tournament.players.filter((player) => player.id === playerId));
    const setup = {
      type: 'match' as const,
      practiceMode: null,
      startingScore: tournament.config.startingScore,
      legsToWin: fixture.legsToWin,
      firstPlayerIndex: drawStarter(2),
      checkoutRange: null,
      checkoutSeed: null,
      checkoutRule: null,
    };
    const config = gameConfig({ ...setup, id: 'new', players });
    createGame(config); // odrzuca złą konfigurację, zanim cokolwiek zapiszemy
    return { ...setup, countsToStats: countsToStats(config), playerIds };
  }

  return {
    create(request) {
      return queue(CREATE_KEY, async () => {
        const found = await store.findPlayers(request.playerIds);
        const unknown = request.playerIds.filter((id) => !found.some((player) => player.id === id));
        if (unknown.length > 0) {
          throw new HttpError(400, 'unknown_player', `Unknown player: ${unknown.join(', ')}`);
        }
        const archived = found.filter((player) => player.archivedAt !== null).map((player) => player.id);
        if (archived.length > 0) {
          throw new HttpError(400, 'archived_player', `Archived player: ${archived.join(', ')}`);
        }
        for (const tournament of await store.listTournaments()) {
          const current = await view(tournament);
          if (current.status === 'in_progress' && current.archivedAt === null) {
            throw new HttpError(409, 'tournament_active', `Tournament ${tournament.id} is still in progress`);
          }
        }
        const order = shuffle(request.playerIds, random);
        computeTournament({ config: request, order, matches: [] }); // odrzuca konfigurację, której silnik nie rozegra
        const id = await store.createTournament(request, order);
        return view(await requireTournament(id));
      });
    },

    async list(query) {
      const items: TournamentListItem[] = [];
      for (const tournament of await store.listTournaments()) {
        const current = await view(tournament);
        if (current.archivedAt !== null && query.archived !== 'include') {
          continue;
        }
        if (query.status !== undefined && current.status !== query.status) {
          continue;
        }
        const { id, name, format, status, createdAt, finishedAt, archivedAt, players, placements } = current;
        items.push({ id, name, format, status, createdAt, finishedAt, archivedAt, players, placements });
      }
      return items.sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : b.createdAt.localeCompare(a.createdAt)));
    },

    async get(id) {
      return view(await requireTournament(id));
    },

    draw(id, expectedSeq) {
      return queue(queueKey(id), async () => {
        const tournament = await requireTournament(id);
        const current = await view(tournament);
        requireSeq(current, expectedSeq);
        requireNotArchived(current);
        if (!current.canRedraw) {
          throw new HttpError(409, 'tournament_started', `Tournament ${id} already has a started fixture`);
        }
        await store.appendTournamentEvent(id, { type: 'draw', order: shuffle(tournament.config.playerIds, random) });
        return publishFresh(tournament);
      });
    },

    startFixture(id, fixtureId, expectedSeq) {
      return queue(queueKey(id), async () => {
        const tournament = await requireTournament(id);
        const { view: current, log } = await load(tournament);
        // Przed expectedSeq, bo powtórzona komenda widzi już seq po własnym zapisie.
        const started = log.find((entry) => entry.type === 'fixture_started' && entry.fixtureId === fixtureId);
        if (started?.type === 'fixture_started') {
          return { statusCode: 200 as const, result: { matchId: started.matchId, tournament: current } };
        }
        requireSeq(current, expectedSeq);
        requireNotArchived(current);
        const fixture = current.fixtures.find((candidate) => candidate.id === fixtureId);
        if (!fixture) {
          throw notFound(`Fixture ${fixtureId} of tournament ${id}`);
        }
        if (fixture.status !== 'ready') {
          throw new HttpError(409, 'fixture_not_ready', `Fixture ${fixtureId} of tournament ${id} is ${fixture.status}`);
        }
        const { matchId } = await store.startFixture(id, fixtureId, fixtureMatch(tournament, fixture));
        return { statusCode: 201 as const, result: { matchId, tournament: await publishFresh(tournament) } };
      });
    },

    archive(id, expectedSeq) {
      return queue(queueKey(id), async () => {
        const tournament = await requireTournament(id);
        const current = await view(tournament);
        requireSeq(current, expectedSeq);
        requireNotArchived(current);
        if (current.status === 'in_progress') {
          throw new HttpError(409, 'tournament_not_finished', `Tournament ${id} is still in progress`);
        }
        await store.appendTournamentEvent(id, { type: 'archived' });
        return publishFresh(tournament);
      });
    },

    async matchLegsChanged(match) {
      const link = match.tournament;
      if (link === null) {
        return;
      }
      await queue(queueKey(link.id), async () => {
        await publishFresh(await requireTournament(link.id));
      });
    },

    // W kolejce turnieju, więc pierwszy tournament_updated nie wyprzedzi wiadomości z równoległej komendy.
    subscribe(id, socket) {
      return queue(queueKey(id), async () => {
        const tournament = await store.findTournament(id);
        if (!tournament) {
          return null;
        }
        const current = await view(tournament);
        const unsubscribe = hub.subscribe(id, socket);
        sendTo<TournamentLiveMessage>(socket, [
          { type: 'tournament_updated', tournamentId: id, eventSeq: current.eventSeq, tournament: current },
        ]);
        return unsubscribe;
      });
    },
  };
}
