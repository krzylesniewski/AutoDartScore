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

export const ReviewReason = z.enum(['low_confidence', 'near_wire', 'detector_disagreement', 'occlusion', 'manual']);
export type ReviewReason = z.infer<typeof ReviewReason>;

// Możliwy odczyt rzutki z prawdopodobieństwem od detektora.
export const ReviewCandidate = z
  .object({
    segment: Segment,
    multiplier: Multiplier,
    probability: z.number().min(0).max(1),
  })
  .refine((candidate) => Hit.safeParse(candidate).success, {
    message: 'Invalid segment and multiplier combination',
    path: ['multiplier'],
  });
export type ReviewCandidate = z.infer<typeof ReviewCandidate>;

// Ścieżka względna wobec katalogu klatek, bez wyjścia poza niego.
const FramePath = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('/') && !value.split(/[\\/]/).includes('..'), { message: 'Frame path must be relative and stay inside the frames directory' });

export const ReviewFrames = z.object({ before: FramePath, after: FramePath });
export type ReviewFrames = z.infer<typeof ReviewFrames>;

// Czubek rzutki na klatce, w pikselach obrazu.
export const ReviewTip = z.object({ x: z.number().min(0), y: z.number().min(0) });
export type ReviewTip = z.infer<typeof ReviewTip>;

// Powód weryfikacji od detektora. manual zostaje dla oznaczenia przez gracza.
export const HitReview = z.object({
  reason: ReviewReason.exclude(['manual']),
  candidates: z.array(ReviewCandidate).max(10).default([]),
  frames: ReviewFrames.optional(),
  tip: ReviewTip.optional(),
});
export type HitReview = z.infer<typeof HitReview>;

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
  review: HitReview.optional(),
}).refine((event) => Hit.safeParse(event).success, {
  message: 'Invalid segment and multiplier combination',
  path: ['multiplier'],
});
export type HitEvent = z.infer<typeof HitEvent>;
