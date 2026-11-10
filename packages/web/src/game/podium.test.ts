import { describe, expect, it } from 'vitest';
import { podiumSlots } from './podium';

function ranked(id: string, position: number | null): { id: string; position: number | null } {
  return { id, position };
}

describe('podiumSlots', () => {
  it('puts three ranked players on the podium in the visual order 2, 1, 3', () => {
    const { podium, rest } = podiumSlots([ranked('a', 1), ranked('b', 2), ranked('c', 3)]);
    expect(podium.map((slot) => [slot.player.id, slot.step, slot.visualOrder])).toEqual([
      ['a', 1, 2],
      ['b', 2, 1],
      ['c', 3, 3],
    ]);
    expect(rest).toEqual([]);
  });

  it('shares a step on a tie', () => {
    expect(podiumSlots([ranked('a', 1), ranked('b', 1), ranked('c', 3)]).podium.map((slot) => slot.step)).toEqual([1, 1, 3]);
    expect(podiumSlots([ranked('a', 1), ranked('b', 2), ranked('c', 2)]).podium.map((slot) => slot.step)).toEqual([1, 2, 2]);
  });

  it('shows only one or two ranked players', () => {
    expect(podiumSlots([ranked('a', 1)]).podium.map((slot) => [slot.player.id, slot.visualOrder])).toEqual([['a', 2]]);
    expect(podiumSlots([ranked('a', 1), ranked('b', 2)]).podium.map((slot) => [slot.player.id, slot.visualOrder])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });

  it('leaves the podium empty without a ranked player', () => {
    const players = [ranked('a', null), ranked('b', null)];
    expect(podiumSlots(players)).toEqual({ podium: [], rest: players });
  });

  it('keeps a fourth player tied with the third in the rest', () => {
    const { podium, rest } = podiumSlots([ranked('a', 1), ranked('b', 2), ranked('c', 3), ranked('d', 3)]);
    expect(podium.map((slot) => slot.player.id)).toEqual(['a', 'b', 'c']);
    expect(rest.map((player) => player.id)).toEqual(['d']);
  });

  it('keeps players without a position in the rest in the original order', () => {
    const { podium, rest } = podiumSlots([ranked('a', 1), ranked('b', 2), ranked('x', null), ranked('y', null)]);
    expect(podium.map((slot) => slot.player.id)).toEqual(['a', 'b']);
    expect(rest.map((player) => player.id)).toEqual(['x', 'y']);
  });
});
