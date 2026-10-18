import { HitEvent } from '@autoscore/schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newEventId } from './event-id';

function hitWith(eventId: string) {
  return { eventId, matchId: 'm1', source: 'keypad', sequence: 0, segment: 20, multiplier: 1, confidence: 1, detectedAt: '2026-10-15T18:30:12.345Z' };
}

describe('newEventId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when it exists', () => {
    expect(HitEvent.safeParse(hitWith(newEventId())).success).toBe(true);
  });

  it('builds a valid uuid without crypto.randomUUID', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    // Jak na stronie otwartej po http z adresu w sieci lokalnej.
    vi.stubGlobal('crypto', { getRandomValues });
    expect(crypto.randomUUID).toBeUndefined();

    const ids = Array.from({ length: 100 }, () => newEventId());
    for (const id of ids) {
      expect(HitEvent.safeParse(hitWith(id)).success, id).toBe(true);
    }
    expect(new Set(ids).size).toBe(100);
  });
});
