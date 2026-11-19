import { z } from 'zod';
import { MatchSnapshot, MatchSnapshotPlayer } from './match-api.js';
import { isSingleEmoji } from './player.js';
import { MatchLegs, MatchSummary } from './stats.js';
import { FixtureId, TournamentId } from './tournament.js';
import { TournamentPlayer, TournamentStats, TournamentViewBase, finishedAtMatchesStatus, finishedAtRule } from './tournament-api.js';

// Zapisany wcześniej avatar może nie być emoji, np. adres zdjęcia. Publiczna odpowiedź ma wtedy null.
const PublicAvatar = z.string().refine(isSingleEmoji, { message: 'Avatar must be a single emoji' }).nullable();

export const PublicTournamentPlayer = TournamentPlayer.pick({ id: true, name: true, color: true }).extend({ avatar: PublicAvatar });
export type PublicTournamentPlayer = z.infer<typeof PublicTournamentPlayer>;

// Widok turnieju dla linku bez tokenu. config zostaje jak przy utworzeniu, razem z config.sharing.
export const PublicTournamentView = TournamentViewBase.omit({ sharing: true, canRedraw: true, eventSeq: true, archivedAt: true })
  .extend({ players: z.array(PublicTournamentPlayer) })
  .refine(finishedAtMatchesStatus, finishedAtRule);
export type PublicTournamentView = z.infer<typeof PublicTournamentView>;

// Tylko id graczy. Imiona i avatary są w publicznym widoku.
export const PublicTournamentStats = TournamentStats;
export type PublicTournamentStats = z.infer<typeof PublicTournamentStats>;

export const PublicMatchPlayer = MatchSnapshotPlayer.pick({ id: true, name: true, color: true, legsWon: true, remaining: true }).extend({
  avatar: PublicAvatar,
});
export type PublicMatchPlayer = z.infer<typeof PublicMatchPlayer>;

export const PublicMatch = MatchSnapshot.pick({
  id: true,
  status: true,
  startingScore: true,
  legsToWin: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  pausedMs: true,
  currentPlayerId: true,
  winnerId: true,
}).extend({ players: z.array(PublicMatchPlayer) });
export type PublicMatch = z.infer<typeof PublicMatch>;

export const PublicTournamentMatch = z.object({
  tournamentId: TournamentId,
  fixtureId: FixtureId,
  label: z.string().min(1),
  match: PublicMatch,
  summary: MatchSummary,
  legs: MatchLegs,
});
export type PublicTournamentMatch = z.infer<typeof PublicTournamentMatch>;

// Wyłączone udostępnianie, archiwalny turniej i nieznane id dają ten sam not_found.
export const PublicApiErrorCode = z.enum(['not_found', 'too_many_requests']);
export type PublicApiErrorCode = z.infer<typeof PublicApiErrorCode>;
