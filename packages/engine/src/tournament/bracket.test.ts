import { describe, expect, it } from 'vitest';
import { bracketSeeds, bracketSize, buildBracket } from './bracket.js';

describe('bracketSeeds', () => {
  it.each([
    [2, [1, 2]],
    [4, [1, 4, 2, 3]],
    [8, [1, 8, 4, 5, 2, 7, 3, 6]],
    [16, [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]],
  ])('orders a bracket of %i', (size, seeds) => {
    expect(bracketSeeds(size)).toEqual(seeds);
  });

  it('puts the lower seed first in every pair', () => {
    const seeds = bracketSeeds(16);
    for (let index = 0; index < seeds.length; index += 2) {
      expect(seeds[index]).toBeLessThan(seeds[index + 1] as number);
    }
  });
});

describe('bracketSize', () => {
  it.each([
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [16, 16],
  ])('fits %i entrants into %i slots', (entrants, size) => {
    expect(bracketSize(entrants)).toBe(size);
  });
});

describe('buildBracket', () => {
  it('names rounds by the number of players and feeds slot 0 from the upper fixture', () => {
    const rounds = buildBracket('c', 3);
    expect(rounds).toEqual([
      [
        {
          id: 'c-sf-1',
          round: 1,
          bracketRound: 'sf',
          sources: [{ kind: 'seed', seed: 1 }, { kind: 'bye' }],
        },
        {
          id: 'c-sf-2',
          round: 1,
          bracketRound: 'sf',
          sources: [
            { kind: 'seed', seed: 2 },
            { kind: 'seed', seed: 3 },
          ],
        },
      ],
      [
        {
          id: 'c-f',
          round: 2,
          bracketRound: 'final',
          sources: [
            { kind: 'winner_of', fixtureId: 'c-sf-1' },
            { kind: 'winner_of', fixtureId: 'c-sf-2' },
          ],
        },
      ],
    ]);
  });

  it('builds a single final for 2 entrants', () => {
    expect(
      buildBracket('p', 2)
        .flat()
        .map((node) => node.id),
    ).toEqual(['p-f']);
  });

  it.each([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])('never pairs two byes for %i entrants', (entrants) => {
    const [first = []] = buildBracket('p', entrants);
    expect(first.some((node) => node.sources.every((source) => source.kind === 'bye'))).toBe(false);
    expect(first.filter((node) => node.sources.some((source) => source.kind === 'bye'))).toHaveLength(bracketSize(entrants) - entrants);
  });

  it('names the rounds of a bracket of 16', () => {
    expect(buildBracket('p', 16).map((round) => [round[0]?.bracketRound, round.length])).toEqual([
      ['r16', 8],
      ['qf', 4],
      ['sf', 2],
      ['final', 1],
    ]);
  });
});
