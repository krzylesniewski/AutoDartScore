import { z } from 'zod';

// Kodowanie trafienia, wspólne dla wszystkich źródeł (klawiatura, symulator, kamera):
// - segmenty 1-20: mnożnik 1 (single), 2 (double) albo 3 (treble),
// - 25: mnożnik 1 to Outer Bull (25 pkt), mnożnik 2 to Bull (50 pkt, liczy się jako double),
// - 0 z mnożnikiem 0: miss (poza tarczą, odbita lotka).
export const MISS_SEGMENT = 0;
export const BULL_SEGMENT = 25;

export const Segment = z.union([z.int().min(0).max(20), z.literal(BULL_SEGMENT)]);
export type Segment = z.infer<typeof Segment>;

export const Multiplier = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type Multiplier = z.infer<typeof Multiplier>;

export const Hit = z
  .object({
    segment: Segment,
    multiplier: Multiplier,
  })
  .refine(
    ({ segment, multiplier }) =>
      segment === MISS_SEGMENT
        ? multiplier === 0
        : segment === BULL_SEGMENT
          ? multiplier === 1 || multiplier === 2
          : multiplier >= 1,
    { message: 'Invalid segment and multiplier combination' },
  );
export type Hit = z.infer<typeof Hit>;

export const HitSource = z.string().min(1); // np. "keypad", "simulator", "camera-1"
export type HitSource = z.infer<typeof HitSource>;

// Zdarzenie trafienia wysyłane do API przez dowolne źródło.
// eventId zapewnia idempotencję: ponowne wysłanie tego samego zdarzenia nie dubluje rzutki.
export const HitEvent = z.object({
  eventId: z.uuid(),
  matchId: z.string().min(1),
  source: HitSource,
  sequence: z.int().min(0),
  segment: Segment,
  multiplier: Multiplier,
  confidence: z.number().min(0).max(1),
  detectedAt: z.iso.datetime(),
}).refine((event) => Hit.safeParse(event).success, {
  message: 'Invalid segment and multiplier combination',
  path: ['multiplier'],
});
export type HitEvent = z.infer<typeof HitEvent>;
