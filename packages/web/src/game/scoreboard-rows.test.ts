import { describe, expect, it } from 'vitest';
import { scoreboardRowOffsets } from './scoreboard-rows';

function calc(current: number, waiting: number, placed: number, slot: number): string {
  return `calc(var(--row-current) * ${current} + var(--row-waiting) * ${waiting} + var(--row-placed) * ${placed} + var(--row-slot) * ${slot})`;
}

describe('scoreboardRowOffsets', () => {
  it('stacks the waiting rows under the thrower', () => {
    expect(scoreboardRowOffsets(['current', 'waiting'])).toEqual({
      offsets: [calc(0, 0, 0, 0), calc(1, 0, 0, 0)],
      height: calc(1, 1, 0, 0),
    });
  });

  it('works with the thrower in the middle', () => {
    expect(scoreboardRowOffsets(['waiting', 'current', 'waiting'])).toEqual({
      offsets: [calc(0, 0, 0, 0), calc(0, 1, 0, 0), calc(1, 1, 0, 0)],
      height: calc(1, 2, 0, 0),
    });
  });

  it('works without a thrower', () => {
    expect(scoreboardRowOffsets(['waiting', 'waiting', 'placed'])).toEqual({
      offsets: [calc(0, 0, 0, 0), calc(0, 1, 0, 0), calc(0, 2, 0, 0)],
      height: calc(0, 2, 1, 0),
    });
  });

  it('puts the free slots under the placed players in a casual game', () => {
    expect(scoreboardRowOffsets(['current', 'placed', 'slot', 'slot'])).toEqual({
      offsets: [calc(0, 0, 0, 0), calc(1, 0, 0, 0), calc(1, 0, 1, 0), calc(1, 0, 1, 1)],
      height: calc(1, 0, 1, 2),
    });
  });

  it('gives an empty list a zero height', () => {
    expect(scoreboardRowOffsets([])).toEqual({ offsets: [], height: calc(0, 0, 0, 0) });
  });
});
