import type { SoundEffect } from './sound-effect.js';

export interface Tone {
  readonly wave: 'sine' | 'square' | 'sawtooth' | 'triangle';
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly gain: number;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const BUST: readonly Tone[] = [
  { wave: 'sawtooth', frequency: 200, endFrequency: 70, startMs: 0, durationMs: 500, gain: 0.6 },
  { wave: 'square', frequency: 150, endFrequency: 55, startMs: 0, durationMs: 500, gain: 0.3 },
];

const FANFARE_SHORT: readonly Tone[] = [
  { wave: 'triangle', frequency: C5, startMs: 0, durationMs: 150, gain: 0.7 },
  { wave: 'triangle', frequency: E5, startMs: 150, durationMs: 150, gain: 0.7 },
  { wave: 'triangle', frequency: G5, startMs: 300, durationMs: 500, gain: 0.8 },
];

const FANFARE_LONG: readonly Tone[] = [
  { wave: 'square', frequency: C5, startMs: 0, durationMs: 150, gain: 0.4 },
  { wave: 'square', frequency: E5, startMs: 150, durationMs: 150, gain: 0.4 },
  { wave: 'square', frequency: G5, startMs: 300, durationMs: 150, gain: 0.4 },
  { wave: 'square', frequency: C6, startMs: 450, durationMs: 350, gain: 0.5 },
  { wave: 'triangle', frequency: C5, startMs: 800, durationMs: 1000, gain: 0.4 },
  { wave: 'triangle', frequency: E5, startMs: 800, durationMs: 1000, gain: 0.4 },
  { wave: 'triangle', frequency: G5, startMs: 800, durationMs: 1000, gain: 0.4 },
  { wave: 'triangle', frequency: C6, startMs: 800, durationMs: 1000, gain: 0.4 },
];

const TONES: Record<SoundEffect, readonly Tone[]> = {
  bust: BUST,
  fanfare_short: FANFARE_SHORT,
  fanfare_long: FANFARE_LONG,
};

// Przepisy jako zwykłe dane, żeby dało się je testować bez przeglądarki.
export function effectTones(effect: SoundEffect): readonly Tone[] {
  return TONES[effect];
}

export function effectDurationMs(effect: SoundEffect): number {
  return Math.max(0, ...effectTones(effect).map((tone) => tone.startMs + tone.durationMs));
}
