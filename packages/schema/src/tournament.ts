import { z } from 'zod';
import { LegsToWin, StartingScore } from './match.js';
import { PlayerId } from './player.js';

// Kopia pomocnika z match-api.ts. Import stamtąd dałby cykl, bo match-api.ts importuje MatchTournament.
function distinct(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

const distinctPlayers = { message: 'Player ids must be distinct', path: ['playerIds'] };

export const TournamentId = z.string().min(1);
export type TournamentId = z.infer<typeof TournamentId>;

// Klucz meczu w turnieju, np. g-7, p-sf-1, p-f, p-3rd, c-f. Nadaje go silnik.
export const FixtureId = z.string().min(1);
export type FixtureId = z.infer<typeof FixtureId>;

// league: każdy z każdym. cup: losowana drabinka. group_playoff: jedna grupa, potem drabinka.
export const TournamentFormat = z.enum(['league', 'cup', 'group_playoff']);
export type TournamentFormat = z.infer<typeof TournamentFormat>;

// Liczba graczy, którzy wychodzą z grupy do drabinki.
export const TournamentAdvance = z.union([z.literal(2), z.literal(4), z.literal(8)]);
export type TournamentAdvance = z.infer<typeof TournamentAdvance>;

export const TOURNAMENT_PLAYER_LIMITS: Readonly<Record<TournamentFormat, { readonly min: number; readonly max: number }>> = {
  league: { min: 3, max: 10 },
  cup: { min: 3, max: 16 },
  group_playoff: { min: 3, max: 10 },
};

export const DEFAULT_TOURNAMENT_STARTING_SCORE: StartingScore = 501;

export const POINTS_PER_WIN = 2;

export const BracketRound = z.enum(['r16', 'qf', 'sf', 'final']);
export type BracketRound = z.infer<typeof BracketRound>;

// Długość meczów w każdej fazie. W lidze group to długość każdego meczu.
export const TournamentLegsToWin = z.object({
  group: LegsToWin.default(3),
  r16: LegsToWin.default(3),
  qf: LegsToWin.default(3),
  sf: LegsToWin.default(3),
  final: LegsToWin.default(4),
  thirdPlace: LegsToWin.default(2),
  consolation: LegsToWin.default(2),
});
export type TournamentLegsToWin = z.infer<typeof TournamentLegsToWin>;

export const TournamentName = z.string().trim().min(1).max(60);
export type TournamentName = z.infer<typeof TournamentName>;

// Domyślną nazwę z datą buduje klient. Przełącznik bez znaczenia w danym formacie przechodzi tylko jako false.
export const TournamentConfig = z
  .object({
    name: TournamentName,
    format: TournamentFormat,
    playerIds: z.array(PlayerId).min(3).max(16).refine(distinct, distinctPlayers),
    startingScore: StartingScore.default(DEFAULT_TOURNAMENT_STARTING_SCORE),
    advance: TournamentAdvance.optional(), // tylko w group_playoff
    thirdPlaceMatch: z.boolean().default(false),
    consolation: z.boolean().default(false),
    legsToWin: TournamentLegsToWin.prefault({}),
    sharing: z.boolean().default(true),
  })
  .superRefine((config, ctx) => {
    if (config.playerIds.length > TOURNAMENT_PLAYER_LIMITS[config.format].max) {
      ctx.addIssue({ code: 'custom', message: `Too many players for ${config.format}`, path: ['playerIds'] });
    }
    if (config.format === 'group_playoff') {
      if (config.advance === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Group and play-off needs advance', path: ['advance'] });
      } else if (config.advance > config.playerIds.length) {
        ctx.addIssue({ code: 'custom', message: 'Advance must not exceed the number of players', path: ['advance'] });
      }
      return;
    }
    if (config.advance !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'Only group and play-off takes advance', path: ['advance'] });
    }
    if (config.consolation) {
      ctx.addIssue({ code: 'custom', message: 'Only group and play-off takes a consolation bracket', path: ['consolation'] });
    }
    if (config.format === 'league' && config.thirdPlaceMatch) {
      ctx.addIssue({ code: 'custom', message: 'A league has no third place match', path: ['thirdPlaceMatch'] });
    }
  });
export type TournamentConfig = z.infer<typeof TournamentConfig>;

export const CreateTournamentRequest = TournamentConfig;
export type CreateTournamentRequest = z.infer<typeof CreateTournamentRequest>;

// Wygrane legi w kolejności slotów. Remisu nie ma.
export const FixtureLegs = z
  .tuple([z.int().min(0).max(9), z.int().min(0).max(9)])
  .refine(([first, second]) => first !== second, { message: 'A fixture has no draws' });
export type FixtureLegs = z.infer<typeof FixtureLegs>;

// Wpisy logu turnieju bez seq i created_at, które dodaje serwer przy zapisie.
// Ostatnie losowanie w logu wyznacza bieżącą kolejność.
export const TournamentDraw = z.object({
  type: z.literal('draw'),
  order: z.array(PlayerId).min(3).max(16).refine(distinct, { message: 'Player ids must be distinct' }),
});
export type TournamentDraw = z.infer<typeof TournamentDraw>;

export const FixtureStarted = z.object({
  type: z.literal('fixture_started'),
  fixtureId: FixtureId,
  matchId: z.string().min(1),
});
export type FixtureStarted = z.infer<typeof FixtureStarted>;

export const PlayerWithdrawn = z.object({
  type: z.literal('player_withdrawn'),
  playerId: PlayerId,
});
export type PlayerWithdrawn = z.infer<typeof PlayerWithdrawn>;

export const ResultCorrected = z.object({
  type: z.literal('result_corrected'),
  fixtureId: FixtureId,
  legs: FixtureLegs,
});
export type ResultCorrected = z.infer<typeof ResultCorrected>;

export const SharingChanged = z.object({
  type: z.literal('sharing_changed'),
  sharing: z.boolean(),
});
export type SharingChanged = z.infer<typeof SharingChanged>;

export const TournamentArchived = z.object({
  type: z.literal('archived'),
});
export type TournamentArchived = z.infer<typeof TournamentArchived>;

export const TournamentEvent = z.discriminatedUnion('type', [
  TournamentDraw,
  FixtureStarted,
  PlayerWithdrawn,
  ResultCorrected,
  SharingChanged,
  TournamentArchived,
]);
export type TournamentEvent = z.infer<typeof TournamentEvent>;

// Powiązanie meczu z turniejem w stanie gry. label to tekst do wyświetlenia, np. „Półfinał 2”.
export const MatchTournament = z.object({
  id: TournamentId,
  name: z.string().min(1),
  fixtureId: FixtureId,
  label: z.string().min(1),
});
export type MatchTournament = z.infer<typeof MatchTournament>;
