import { z } from 'zod';
import { LegsToWin } from './match.js';
import { ExpectedSeq, MatchSnapshotPlayer, STALE_STATE } from './match-api.js';
import { PlayerId } from './player.js';
import {
  BracketRound,
  FixtureId,
  FixtureLegs,
  POINTS_PER_WIN,
  TournamentConfig,
  TournamentFormat,
  TournamentId,
  TournamentName,
} from './tournament.js';

export const TournamentPlayer = MatchSnapshotPlayer.pick({ id: true, name: true, avatar: true, color: true, guest: true });
export type TournamentPlayer = z.infer<typeof TournamentPlayer>;

// Gracze mogą dzielić miejsce, np. dwa trzecie miejsca.
export const TournamentPlacement = z.object({
  playerId: PlayerId,
  place: z.int().min(1).max(16),
});
export type TournamentPlacement = z.infer<typeof TournamentPlacement>;

// Mecze ligi mają fazę group, mecze drabinki pucharu fazę playoff.
export const FixturePhase = z.enum(['group', 'playoff', 'third_place', 'consolation']);
export type FixturePhase = z.infer<typeof FixturePhase>;

export const FixtureStatus = z.enum(['waiting', 'ready', 'in_progress', 'finished', 'walkover', 'bye']);
export type FixtureStatus = z.infer<typeof FixtureStatus>;

export const FixtureSlot = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('player'),
    playerId: PlayerId,
    seed: z.int().min(1).nullable(), // rozstawienie w drabince, null w grupie
  }),
  z.object({ kind: z.literal('winner_of'), fixtureId: FixtureId }),
  z.object({ kind: z.literal('loser_of'), fixtureId: FixtureId }),
  z.object({ kind: z.literal('standing'), place: z.int().min(1) }), // miejsce w tabeli grupy
  z.object({ kind: z.literal('bye') }),
]);
export type FixtureSlot = z.infer<typeof FixtureSlot>;

export const FixtureResult = z.object({
  legs: FixtureLegs,
  winnerId: PlayerId,
  corrected: z.boolean(),
});
export type FixtureResult = z.infer<typeof FixtureResult>;

const RESULT_STATUSES: readonly FixtureStatus[] = ['finished', 'walkover'];

function winnerSlot(fixture: { slots: readonly FixtureSlot[]; result: FixtureResult | null }): number {
  return fixture.slots.findIndex((slot) => slot.kind === 'player' && slot.playerId === fixture.result?.winnerId);
}

// Walkower to legsToWin:0 dla zwycięzcy, więc mieści się w zasadzie wyniku.
export const Fixture = z
  .object({
    id: FixtureId,
    number: z.int().min(1), // kolejność gry
    phase: FixturePhase,
    round: z.int().min(1), // runda w fazie, mecz o 3. miejsce ma 1
    bracketRound: BracketRound.nullable(), // tylko w playoff i consolation
    board: z.int().min(1), // na razie zawsze 1
    legsToWin: LegsToWin,
    slots: z.tuple([FixtureSlot, FixtureSlot]),
    status: FixtureStatus,
    matchId: z.string().min(1).nullable(),
    result: FixtureResult.nullable(),
    averages: z.tuple([z.number().min(0), z.number().min(0)]).nullable(), // na razie zawsze null
  })
  .refine((fixture) => (fixture.result !== null) === RESULT_STATUSES.includes(fixture.status), {
    message: 'Only a finished fixture or a walkover has a result',
    path: ['result'],
  })
  .refine((fixture) => fixture.result === null || winnerSlot(fixture) !== -1, {
    message: 'The winner must be a player in the fixture',
    path: ['result', 'winnerId'],
  })
  .refine(
    (fixture) => {
      const winner = winnerSlot(fixture);
      if (fixture.result === null || winner === -1) {
        return true;
      }
      const [first, second] = fixture.result.legs;
      const [winnerLegs, loserLegs] = winner === 0 ? [first, second] : [second, first];
      return winnerLegs === fixture.legsToWin && loserLegs < fixture.legsToWin;
    },
    { message: 'The winner must have legsToWin legs and the loser fewer', path: ['result', 'legs'] },
  );
export type Fixture = z.infer<typeof Fixture>;

export const StandingRow = z
  .object({
    playerId: PlayerId,
    place: z.int().min(1),
    played: z.int().min(0),
    won: z.int().min(0),
    lost: z.int().min(0),
    legsFor: z.int().min(0),
    legsAgainst: z.int().min(0),
    legDifference: z.int(),
    points: z.int().min(0),
    average: z.number().min(0).nullable(), // na razie zawsze null
    withdrawn: z.boolean(),
    advances: z.boolean(),
  })
  .refine((row) => row.played === row.won + row.lost, { message: 'Played must equal won plus lost', path: ['played'] })
  .refine((row) => row.legDifference === row.legsFor - row.legsAgainst, {
    message: 'Leg difference must equal legs for minus legs against',
    path: ['legDifference'],
  })
  .refine((row) => row.points === row.won * POINTS_PER_WIN, { message: 'Points must follow from wins', path: ['points'] });
export type StandingRow = z.infer<typeof StandingRow>;

export const TournamentStatus = z.enum(['in_progress', 'finished']);
export type TournamentStatus = z.infer<typeof TournamentStatus>;

// Bez refine, bo Zod nie pozwala na pick() z obiektu z refine. Z tej bazy powstaje TournamentListItem.
const TournamentViewBase = z.object({
  id: TournamentId,
  name: TournamentName,
  format: TournamentFormat,
  config: TournamentConfig, // jak przy utworzeniu, z wartościami domyślnymi
  status: TournamentStatus,
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  players: z.array(TournamentPlayer), // w kolejności zgłoszenia
  fixtures: z.array(Fixture),
  standings: z.array(StandingRow), // pusta w pucharze
  nextFixtureId: FixtureId.nullable(),
  liveFixtureId: FixtureId.nullable(),
  placements: z.array(TournamentPlacement), // w trakcie turnieju tylko znane miejsca
  sharing: z.boolean(), // bieżąca wartość po sharing_changed. config.sharing zostaje z utworzenia
  canRedraw: z.boolean(),
  eventSeq: z.int().min(0),
  archivedAt: z.iso.datetime().nullable(),
});

function finishedAtMatchesStatus(view: { status: TournamentStatus; finishedAt: string | null }): boolean {
  return (view.finishedAt !== null) === (view.status === 'finished');
}

const finishedAtRule = { message: 'Only a finished tournament has finishedAt', path: ['finishedAt'] };

// Stan turnieju odtworzony z konfiguracji, logu turnieju i wyników powiązanych meczów.
export const TournamentView = TournamentViewBase.refine(finishedAtMatchesStatus, finishedAtRule);
export type TournamentView = z.infer<typeof TournamentView>;

export const TournamentListQuery = z.object({
  status: TournamentStatus.optional(),
  archived: z.literal('include').optional(),
});
export type TournamentListQuery = z.infer<typeof TournamentListQuery>;

export const TournamentListItem = TournamentViewBase.pick({
  id: true,
  name: true,
  format: true,
  status: true,
  createdAt: true,
  finishedAt: true,
  archivedAt: true,
  players: true,
  placements: true,
}).refine(finishedAtMatchesStatus, finishedAtRule);
export type TournamentListItem = z.infer<typeof TournamentListItem>;

export const StartFixtureResult = z.object({
  matchId: z.string().min(1),
  tournament: TournamentView,
});
export type StartFixtureResult = z.infer<typeof StartFixtureResult>;

export const TournamentApiErrorCode = z.enum([
  'tournament_active',
  'tournament_started',
  'fixture_not_ready',
  'tournament_not_finished',
  'tournament_archived',
  'archived_player',
  'fixture_not_finished',
  'invalid_result',
  'dependent_started',
  'already_withdrawn',
  'tournament_finished',
  'player_withdrawn',
]);
export type TournamentApiErrorCode = z.infer<typeof TournamentApiErrorCode>;

// Odpowiedź 409 na komendę turnieju z nieaktualnym expectedSeq. Jest też poprawnym ApiError.
export const TournamentStaleStateError = z.object({
  error: z.literal(STALE_STATE),
  message: z.string(),
  tournament: TournamentView,
});
export type TournamentStaleStateError = z.infer<typeof TournamentStaleStateError>;

// eventSeq to najwyższy seq logu turnieju. Zmiana legów w meczu turnieju wysyła widok z tym samym eventSeq.
export const TournamentUpdated = z.object({
  type: z.literal('tournament_updated'),
  tournamentId: TournamentId,
  eventSeq: z.int().min(0),
  tournament: TournamentView,
});
export type TournamentUpdated = z.infer<typeof TournamentUpdated>;

// Wiadomości WebSocket dla jednego turnieju.
export const TournamentLiveMessage = z.discriminatedUnion('type', [TournamentUpdated]);
export type TournamentLiveMessage = z.infer<typeof TournamentLiveMessage>;

// Serwer sprawdza, czy zwycięzca ma dokładnie tyle legów, ile wymaga mecz.
export const CorrectResultRequest = z.object({
  legs: FixtureLegs,
  expectedSeq: ExpectedSeq.optional(),
});
export type CorrectResultRequest = z.infer<typeof CorrectResultRequest>;

export const WithdrawPlayerRequest = z.object({
  playerId: PlayerId,
  expectedSeq: ExpectedSeq.optional(),
});
export type WithdrawPlayerRequest = z.infer<typeof WithdrawPlayerRequest>;

export const SharingRequest = z.object({
  sharing: z.boolean(),
  expectedSeq: ExpectedSeq.optional(),
});
export type SharingRequest = z.infer<typeof SharingRequest>;
