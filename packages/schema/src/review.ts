import { z } from 'zod';
import { Hit, HitSource, Multiplier, ReviewCandidate, ReviewFrames, ReviewReason, ReviewTip, Segment } from './hit.js';

export const ReviewActor = z.enum(['system', 'player']);
export type ReviewActor = z.infer<typeof ReviewActor>;

// pending: rzutka czeka na weryfikację. Każda inna jest confirmed.
export const ThrowStatus = z.enum(['confirmed', 'pending']);
export type ThrowStatus = z.infer<typeof ThrowStatus>;

// counted: liczy się w grze. waiting: czeka za rzutką do weryfikacji. void: nie liczy się, bo tura skończyła się przed nią.
export const ThrowScoring = z.enum(['counted', 'waiting', 'void']);
export type ThrowScoring = z.infer<typeof ThrowScoring>;

export const ReviewResolution = z
  .object({
    segment: Segment,
    multiplier: Multiplier,
    by: ReviewActor,
    at: z.iso.datetime(),
  })
  .refine((resolution) => Hit.safeParse(resolution).success, {
    message: 'Invalid segment and multiplier combination',
    path: ['multiplier'],
  });
export type ReviewResolution = z.infer<typeof ReviewResolution>;

// Ostatnie oznaczenie rzutki do weryfikacji. resolved jest null, dopóki nikt jej nie zweryfikował.
export const ThrowReview = z.object({
  reason: ReviewReason,
  flaggedBy: ReviewActor,
  candidates: z.array(ReviewCandidate).max(10),
  frames: ReviewFrames.optional(),
  tip: ReviewTip.optional(),
  resolved: ReviewResolution.nullable(),
});
export type ThrowReview = z.infer<typeof ThrowReview>;

// Rzutka z punktu widzenia weryfikacji. reading to odczyt źródła, value to ostatnia zweryfikowana wartość albo reading.
export const ReviewedThrow = z.object({
  id: z.string().min(1),
  sequence: z.int().min(0),
  source: HitSource,
  confidence: z.number().min(0).max(1),
  reading: Hit,
  value: Hit,
  status: ThrowStatus,
  scoring: ThrowScoring,
  review: ThrowReview.nullable(), // null, gdy rzutki nigdy nie oznaczono
});
export type ReviewedThrow = z.infer<typeof ReviewedThrow>;

export const VerifyThrowRequest = Hit;
export type VerifyThrowRequest = z.infer<typeof VerifyThrowRequest>;
