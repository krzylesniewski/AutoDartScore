import { z } from 'zod';

// Gość to zwykły gracz z flagą guest, więc silnik i tak dostaje różne identyfikatory graczy.
export const Player = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatar: z.string().nullable(), // emoji
  guest: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type Player = z.infer<typeof Player>;

export const CreatePlayerRequest = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: z.string().min(1).max(16).optional(),
  guest: z.boolean().default(false),
});
export type CreatePlayerRequest = z.infer<typeof CreatePlayerRequest>;
