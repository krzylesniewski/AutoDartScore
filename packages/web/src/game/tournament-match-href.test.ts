import { describe, expect, it } from 'vitest';
import { tournamentMatchHref } from './tournament-match-href';

describe('tournamentMatchHref', () => {
  it('builds the match page address with both ids encoded', () => {
    expect(tournamentMatchHref('t1', 'm1')).toBe('#/tournaments/t1/matches/m1');
    expect(tournamentMatchHref('t 1', 'm/2')).toBe('#/tournaments/t%201/matches/m%2F2');
  });
});
