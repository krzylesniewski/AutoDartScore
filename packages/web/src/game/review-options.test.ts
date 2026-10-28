import type { ThrowReview } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { reviewedThrow } from '../test/snapshots';
import { reviewOptions } from './review-options';

function review(candidates: ThrowReview['candidates']): ThrowReview {
  return { reason: 'near_wire', flaggedBy: 'system', candidates, resolved: null };
}

describe('reviewOptions', () => {
  it('sorts the candidates by probability, highest first', () => {
    const entry = reviewedThrow('t1', {
      value: { segment: 5, multiplier: 1 },
      review: review([
        { segment: 1, multiplier: 1, probability: 0.1 },
        { segment: 20, multiplier: 3, probability: 0.6 },
        { segment: 12, multiplier: 1, probability: 0.3 },
      ]),
    });
    expect(reviewOptions(entry).map((candidate) => candidate.segment)).toEqual([20, 12, 1]);
  });

  it('keeps the input order on a tie', () => {
    const entry = reviewedThrow('t1', {
      value: { segment: 5, multiplier: 1 },
      review: review([
        { segment: 1, multiplier: 1, probability: 0.4 },
        { segment: 20, multiplier: 1, probability: 0.4 },
      ]),
    });
    expect(reviewOptions(entry).map((candidate) => candidate.segment)).toEqual([1, 20]);
  });

  it('drops the candidate equal to the value and keeps the other multiplier', () => {
    const entry = reviewedThrow('t1', {
      value: { segment: 20, multiplier: 3 },
      review: review([
        { segment: 20, multiplier: 3, probability: 0.5 },
        { segment: 20, multiplier: 1, probability: 0.3 },
      ]),
    });
    expect(reviewOptions(entry)).toEqual([{ segment: 20, multiplier: 1, probability: 0.3 }]);
  });

  it('is empty without a review or without candidates', () => {
    expect(reviewOptions(reviewedThrow('t1'))).toEqual([]);
    expect(reviewOptions(reviewedThrow('t1', { review: review([]) }))).toEqual([]);
  });
});
