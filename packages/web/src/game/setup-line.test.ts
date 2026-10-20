import { describe, expect, it } from 'vitest';
import { INITIAL_SETUP } from './game-setup';
import { setupLine } from './setup-line';

describe('setupLine', () => {
  it('describes a 1v1', () => {
    expect(setupLine(INITIAL_SETUP)).toBe('301 · Best of 1 · Straight-in, double-out · Losowanie przy starcie');
  });

  it('describes Zabawa', () => {
    expect(setupLine({ ...INITIAL_SETUP, type: 'casual', startingScore: 701 })).toBe('701 · Jeden leg, ranking miejsc · Straight-in, double-out · Losowanie przy starcie');
  });

  it('describes Free run', () => {
    expect(setupLine({ ...INITIAL_SETUP, type: 'practice', practiceMode: 'free_run' })).toBe('Free run · Bez zasad, tylko notuje rzuty');
  });

  it('describes Solo 501', () => {
    expect(setupLine({ ...INITIAL_SETUP, type: 'practice', practiceMode: 'solo_501' })).toBe('Solo 501 · Straight-in, double-out');
  });
});
