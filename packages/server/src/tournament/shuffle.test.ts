import { describe, expect, it } from 'vitest';
import { shuffle } from './shuffle.js';

const ids = ['a', 'b', 'c', 'd', 'e'];

function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length] as number;
}

describe('shuffle', () => {
  it('returns a permutation and leaves the input unchanged', () => {
    const input = [...ids];
    const result = shuffle(input, sequence([0.3, 0.9, 0.1, 0.6]));
    expect(input).toEqual(ids);
    expect([...result].sort()).toEqual(ids);
  });

  it('swaps each position with the first when random returns 0', () => {
    expect(shuffle(ids, () => 0)).toEqual(['b', 'c', 'd', 'e', 'a']);
  });

  it('keeps the order when random returns values close to 1', () => {
    expect(shuffle(ids, () => 0.999_999_999)).toEqual(ids);
    expect(shuffle(ids, () => 1 - Number.EPSILON / 2)).toEqual(ids);
  });

  it('caps the index at i when random returns 1', () => {
    expect(shuffle(ids, () => 1)).toEqual(ids);
  });

  it('handles an empty list and a single item', () => {
    expect(shuffle([], () => 0.5)).toEqual([]);
    expect(shuffle(['a'], () => 0.5)).toEqual(['a']);
  });

  it('gives every order of three items for some random values', () => {
    const orders = new Set<string>();
    for (const first of [0, 0.4, 0.8]) {
      for (const second of [0, 0.6]) {
        orders.add(shuffle(['a', 'b', 'c'], sequence([first, second])).join(''));
      }
    }
    expect(orders.size).toBe(6);
  });
});
