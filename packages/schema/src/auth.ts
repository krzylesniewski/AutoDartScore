import { z } from 'zod';

// Bez trim, bo spacje mogą być częścią hasła.
export const LoginRequest = z.object({
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
  token: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

// Pierwsza wiadomość klienta na WebSocket. Przeglądarka nie ustawi nagłówka, a token w URL trafiłby do logów proxy.
export const LiveAuthMessage = z.object({
  type: z.literal('auth'),
  token: z.string().min(1),
});
export type LiveAuthMessage = z.infer<typeof LiveAuthMessage>;
