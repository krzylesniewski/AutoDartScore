import { CreateTournamentRequest, type TournamentConfig } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import { tournamentPlan } from './tournament-plan';

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

function config(fields: Record<string, unknown>): TournamentConfig {
  return CreateTournamentRequest.parse({ name: 'Test', ...fields });
}

function counts(fields: Record<string, unknown>): { rows: Record<string, number>; total: number } {
  const plan = tournamentPlan(config(fields));
  return { rows: Object.fromEntries(plan.rows.map((row) => [row.key, row.count])), total: plan.total };
}

describe('tournamentPlan', () => {
  it('counts a league of 4 players', () => {
    expect(counts({ format: 'league', playerIds: ids(4) })).toEqual({ rows: { group: 6 }, total: 6 });
  });

  it('counts a league of 10 players', () => {
    expect(counts({ format: 'league', playerIds: ids(10) }).total).toBe(45);
  });

  it('labels the league row by the format', () => {
    expect(tournamentPlan(config({ format: 'league', playerIds: ids(4) })).rows[0]?.label).toBe('Liga, każdy z każdym');
    expect(tournamentPlan(config({ format: 'group_playoff', advance: 2, playerIds: ids(4) })).rows[0]?.label).toBe(
      'Faza grupowa, każdy z każdym',
    );
  });

  it('counts a cup of 3 players without a third place match', () => {
    expect(counts({ format: 'cup', playerIds: ids(3) })).toEqual({ rows: { sf: 1, final: 1 }, total: 2 });
    expect(counts({ format: 'cup', playerIds: ids(3), thirdPlaceMatch: true })).toEqual({ rows: { sf: 1, final: 1 }, total: 2 });
  });

  it('counts a cup of 5 players with and without a third place match', () => {
    expect(counts({ format: 'cup', playerIds: ids(5) })).toEqual({ rows: { qf: 1, sf: 2, final: 1 }, total: 4 });
    expect(counts({ format: 'cup', playerIds: ids(5), thirdPlaceMatch: true })).toEqual({
      rows: { qf: 1, sf: 2, final: 1, third_place: 1 },
      total: 5,
    });
  });

  it('counts a cup of 16 players with and without a third place match', () => {
    expect(counts({ format: 'cup', playerIds: ids(16) }).total).toBe(15);
    expect(counts({ format: 'cup', playerIds: ids(16), thirdPlaceMatch: true }).total).toBe(16);
  });

  it('counts a group of 6 with advance 4 and both extras', () => {
    const plan = tournamentPlan(
      config({ format: 'group_playoff', playerIds: ids(6), advance: 4, thirdPlaceMatch: true, consolation: true }),
    );
    expect(plan.rows.map((row) => [row.label, row.count])).toEqual([
      ['Faza grupowa, każdy z każdym', 15],
      ['Półfinały', 2],
      ['Finał', 1],
      ['Mecz o 3. miejsce', 1],
      ['Pocieszenie', 1],
    ]);
    expect(plan.total).toBe(20);
  });

  it('counts a group of 6 with advance 2 and a consolation bracket', () => {
    expect(counts({ format: 'group_playoff', playerIds: ids(6), advance: 2, consolation: true })).toEqual({
      rows: { group: 15, final: 1, consolation: 3 },
      total: 19,
    });
  });
});
