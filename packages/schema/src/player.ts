import { z } from 'zod';

// Stały kolor avatara: numer tokenu --color-avatar-N w motywie.
export const PLAYER_COLOR_COUNT = 16;
export const PlayerColor = z.int().min(1).max(PLAYER_COLOR_COUNT);
export type PlayerColor = z.infer<typeof PlayerColor>;

// Gość to zwykły gracz z flagą guest, więc silnik i tak dostaje różne identyfikatory graczy.
export const Player = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatar: z.string().nullable(), // emoji
  color: PlayerColor,
  guest: z.boolean(),
  archivedAt: z.iso.datetime().nullable(), // archiwizacja zamiast usuwania
  createdAt: z.iso.datetime(),
});
export type Player = z.infer<typeof Player>;

export const CreatePlayerRequest = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: z.string().min(1).max(16).optional(),
  color: PlayerColor.optional(), // bez koloru serwer dobiera stały kolor z id
  guest: z.boolean().default(false),
});
export type CreatePlayerRequest = z.infer<typeof CreatePlayerRequest>;

// avatar: null czyści avatar. Gościa da się zapisać (guest: false), ale gracz nie wraca do gości.
export const UpdatePlayerRequest = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    avatar: z.string().min(1).max(16).nullable().optional(),
    color: PlayerColor.optional(), // koloru nie da się wyczyścić, tylko zmienić
    archived: z.boolean().optional(),
    guest: z.literal(false).optional(),
  })
  .refine((request) => Object.keys(request).length > 0, { message: 'Nothing to update' });
export type UpdatePlayerRequest = z.infer<typeof UpdatePlayerRequest>;

export const ListPlayersQuery = z.object({ archived: z.literal('include').optional() });
export type ListPlayersQuery = z.infer<typeof ListPlayersQuery>;
