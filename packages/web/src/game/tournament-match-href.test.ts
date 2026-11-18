import { describe, expect, it } from 'vitest';
import { publicTournamentHref, publicTournamentMatchHref, tournamentMatchHref } from './tournament-match-href';

describe('tournamentMatchHref', () => {
  it('builds the match page address with both ids encoded', () => {
    expect(tournamentMatchHref('t1', 'm1')).toBe('#/tournaments/t1/matches/m1');
    expect(tournamentMatchHref('t 1', 'm/2')).toBe('#/tournaments/t%201/matches/m%2F2');
  });
});

describe('publicTournamentHref', () => {
  it('builds the public tournament address with the id encoded', () => {
    expect(publicTournamentHref('t1')).toBe('#/t/t1');
    expect(publicTournamentHref('t/1 a')).toBe('#/t/t%2F1%20a');
  });
});

describe('publicTournamentMatchHref', () => {
  it('builds the public match address with both ids encoded', () => {
    expect(publicTournamentMatchHref('t1', 'm1')).toBe('#/t/t1/matches/m1');
    expect(publicTournamentMatchHref('t 1', 'm/2')).toBe('#/t/t%201/matches/m%2F2');
  });
});
