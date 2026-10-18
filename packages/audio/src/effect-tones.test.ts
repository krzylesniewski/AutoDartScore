import { describe, expect, it } from 'vitest';
import { effectDurationMs, effectTones, type SoundEffect } from './index.js';

const EFFECTS: SoundEffect[] = ['bust', 'fanfare_short', 'fanfare_long'];

describe('effectTones', () => {
  it.each([
    ['bust', 500],
    ['fanfare_short', 800],
    ['fanfare_long', 1800],
  ] as const)('%s lasts %i ms', (effect, duration) => {
    expect(effectDurationMs(effect)).toBe(duration);
  });

  it('makes the bust tones fall in frequency', () => {
    const tones = effectTones('bust');
    expect(tones.length).toBeGreaterThan(0);
    for (const tone of tones) {
      expect(['sawtooth', 'square']).toContain(tone.wave);
      expect(tone.endFrequency).toBeDefined();
      expect(tone.endFrequency ?? Infinity).toBeLessThan(tone.frequency);
    }
  });

  it('makes the short fanfare rise', () => {
    const frequencies = effectTones('fanfare_short').map((tone) => tone.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => a - b));
  });

  it.each(EFFECTS)('keeps every %s tone audible and inside the effect', (effect) => {
    const duration = effectDurationMs(effect);
    for (const tone of effectTones(effect)) {
      expect(tone.gain).toBeGreaterThan(0);
      expect(tone.gain).toBeLessThanOrEqual(1);
      expect(tone.frequency).toBeGreaterThan(0);
      expect(tone.durationMs).toBeGreaterThan(0);
      expect(tone.startMs).toBeGreaterThanOrEqual(0);
      expect(tone.startMs + tone.durationMs).toBeLessThanOrEqual(duration);
    }
  });
});
