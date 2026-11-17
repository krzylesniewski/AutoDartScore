import { CreateTournamentRequest } from '@autoscore/schema';
import { describe, expect, it } from 'vitest';
import {
  changeTournamentFormat,
  createTournamentRequest,
  defaultTournamentName,
  extrasAvailable,
  initialTournamentSetup,
  legsPhases,
  pickTournamentPlayer,
  stepLegs,
  tournamentProblem,
  type TournamentSetup,
} from './tournament-setup';

const TODAY = new Date(2027, 2, 7, 23, 30);

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

function setup(overrides: Partial<TournamentSetup> = {}): TournamentSetup {
  return { ...initialTournamentSetup(TODAY), ...overrides };
}

describe('defaultTournamentName', () => {
  it('uses the zero-padded local date', () => {
    expect(defaultTournamentName(TODAY)).toBe('Turniej 07.03.2027');
    expect(defaultTournamentName(new Date(2026, 10, 17))).toBe('Turniej 17.11.2026');
  });
});

describe('initialTournamentSetup', () => {
  it('starts with a group and play-off of 501 without players', () => {
    expect(initialTournamentSetup(TODAY)).toEqual({
      name: 'Turniej 07.03.2027',
      format: 'group_playoff',
      playerIds: [],
      startingScore: 501,
      advance: 4,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin: { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 },
      sharing: true,
    });
  });
});

describe('pickTournamentPlayer', () => {
  it('toggles a player', () => {
    const picked = pickTournamentPlayer(setup(), 'p1');
    expect(picked.playerIds).toEqual(['p1']);
    expect(pickTournamentPlayer(picked, 'p1').playerIds).toEqual([]);
  });

  it.each([
    ['league', 10],
    ['cup', 16],
    ['group_playoff', 10],
  ] as const)('does not add a player above the %s limit of %i', (format, max) => {
    const full = setup({ format, playerIds: ids(max) });
    expect(pickTournamentPlayer(full, 'extra').playerIds).toHaveLength(max);
    expect(pickTournamentPlayer(setup({ format, playerIds: ids(max - 1) }), 'extra').playerIds).toHaveLength(max);
  });
});

describe('changeTournamentFormat', () => {
  it('keeps the earliest picked players within the new limit', () => {
    const changed = changeTournamentFormat(setup({ format: 'cup', playerIds: ids(14) }), 'league');
    expect(changed.format).toBe('league');
    expect(changed.playerIds).toEqual(ids(10));
  });

  it('keeps every player when the limit grows', () => {
    expect(changeTournamentFormat(setup({ format: 'league', playerIds: ids(10) }), 'cup').playerIds).toEqual(ids(10));
  });
});

describe('stepLegs', () => {
  it('changes one phase', () => {
    const stepped = stepLegs(setup(), 'final', 1);
    expect(stepped.legsToWin.final).toBe(5);
    expect(stepped.legsToWin.sf).toBe(3);
  });

  it('clamps at 1 and 9', () => {
    let current = setup();
    for (let step = 0; step < 12; step += 1) {
      current = stepLegs(current, 'group', -1);
    }
    expect(current.legsToWin.group).toBe(1);
    for (let step = 0; step < 12; step += 1) {
      current = stepLegs(current, 'group', 1);
    }
    expect(current.legsToWin.group).toBe(9);
  });
});

describe('extrasAvailable', () => {
  it('needs 4 players for a third place match in a cup', () => {
    expect(extrasAvailable(setup({ format: 'cup', playerIds: ids(3) }))).toEqual({ thirdPlace: false, consolation: false });
    expect(extrasAvailable(setup({ format: 'cup', playerIds: ids(4) }))).toEqual({ thirdPlace: true, consolation: false });
  });

  it('needs advance 4 or 8 for a third place match after a group', () => {
    expect(extrasAvailable(setup({ playerIds: ids(6), advance: 2 })).thirdPlace).toBe(false);
    expect(extrasAvailable(setup({ playerIds: ids(6), advance: 4 })).thirdPlace).toBe(true);
    expect(extrasAvailable(setup({ playerIds: ids(8), advance: 8 })).thirdPlace).toBe(true);
  });

  it('needs 2 players outside the play-off for a consolation bracket', () => {
    expect(extrasAvailable(setup({ playerIds: ids(5), advance: 4 })).consolation).toBe(false);
    expect(extrasAvailable(setup({ playerIds: ids(6), advance: 4 })).consolation).toBe(true);
  });

  it('has no extras in a league', () => {
    expect(extrasAvailable(setup({ format: 'league', playerIds: ids(10) }))).toEqual({ thirdPlace: false, consolation: false });
  });
});

describe('legsPhases', () => {
  it('shows only the league matches in a league', () => {
    expect(legsPhases(setup({ format: 'league', playerIds: ids(6), thirdPlaceMatch: true, consolation: true }))).toEqual(['group']);
  });

  it.each([
    [0, ['sf', 'final']],
    [3, ['sf', 'final']],
    [4, ['sf', 'final']],
    [5, ['qf', 'sf', 'final']],
    [8, ['qf', 'sf', 'final']],
    [9, ['r16', 'qf', 'sf', 'final']],
    [16, ['r16', 'qf', 'sf', 'final']],
  ])('shows the bracket rounds of a cup with %i players', (count, phases) => {
    expect(legsPhases(setup({ format: 'cup', playerIds: ids(count) }))).toEqual(phases);
  });

  it.each([
    [2, ['group', 'final']],
    [4, ['group', 'sf', 'final']],
    [8, ['group', 'qf', 'sf', 'final']],
  ] as const)('shows the group and the play-off of %i', (advance, phases) => {
    expect(legsPhases(setup({ playerIds: ids(10), advance }))).toEqual(phases);
  });

  it('appends the extras that are on and available', () => {
    expect(legsPhases(setup({ playerIds: ids(6), thirdPlaceMatch: true, consolation: true }))).toEqual([
      'group',
      'sf',
      'final',
      'thirdPlace',
      'consolation',
    ]);
    expect(legsPhases(setup({ playerIds: ids(5), thirdPlaceMatch: true, consolation: true }))).toEqual([
      'group',
      'sf',
      'final',
      'thirdPlace',
    ]);
    expect(legsPhases(setup({ format: 'cup', playerIds: ids(3), thirdPlaceMatch: true }))).toEqual(['sf', 'final']);
  });
});

describe('createTournamentRequest', () => {
  const legsToWin = { group: 3, r16: 3, qf: 3, sf: 3, final: 4, thirdPlace: 2, consolation: 2 };

  it('sends a league without advance and with both extras off', () => {
    const body = createTournamentRequest(setup({ format: 'league', playerIds: ids(4), thirdPlaceMatch: true, consolation: true }));
    expect(body).toEqual({
      name: 'Turniej 07.03.2027',
      format: 'league',
      playerIds: ids(4),
      startingScore: 501,
      thirdPlaceMatch: false,
      consolation: false,
      legsToWin,
      sharing: true,
    });
    expect(CreateTournamentRequest.safeParse(body).success).toBe(true);
  });

  it('sends a cup without advance and without a consolation bracket', () => {
    const body = createTournamentRequest(setup({ format: 'cup', playerIds: ids(5), thirdPlaceMatch: true, consolation: true }));
    expect(body).not.toHaveProperty('advance');
    expect(body).toMatchObject({ format: 'cup', thirdPlaceMatch: true, consolation: false });
    expect(CreateTournamentRequest.safeParse(body).success).toBe(true);
  });

  it('sends a group with advance and the available extras', () => {
    const body = createTournamentRequest(
      setup({ playerIds: ids(6), advance: 4, thirdPlaceMatch: true, consolation: true, sharing: false, startingScore: 701 }),
    );
    expect(body).toEqual({
      name: 'Turniej 07.03.2027',
      format: 'group_playoff',
      playerIds: ids(6),
      startingScore: 701,
      advance: 4,
      thirdPlaceMatch: true,
      consolation: true,
      legsToWin,
      sharing: false,
    });
  });

  it('sends an unavailable toggle as false', () => {
    expect(createTournamentRequest(setup({ format: 'cup', playerIds: ids(3), thirdPlaceMatch: true }))).toMatchObject({
      thirdPlaceMatch: false,
    });
    expect(createTournamentRequest(setup({ playerIds: ids(5), advance: 4, consolation: true }))).toMatchObject({ consolation: false });
    expect(createTournamentRequest(setup({ playerIds: ids(6), advance: 2, thirdPlaceMatch: true }))).toMatchObject({
      thirdPlaceMatch: false,
    });
  });
});

describe('tournamentProblem', () => {
  it('reports the player count first', () => {
    expect(tournamentProblem(setup({ name: ' ', playerIds: ids(2), advance: 8 }))).toEqual({ kind: 'players', min: 3, max: 10 });
    expect(tournamentProblem(setup({ format: 'cup', playerIds: ids(2) }))).toEqual({ kind: 'players', min: 3, max: 16 });
  });

  it('reports advance above the player count, then an empty name', () => {
    expect(tournamentProblem(setup({ name: ' ', playerIds: ids(6), advance: 8 }))).toEqual({ kind: 'advance' });
    expect(tournamentProblem(setup({ name: '  ', playerIds: ids(6) }))).toEqual({ kind: 'name' });
  });

  it('accepts a valid setup', () => {
    expect(tournamentProblem(setup({ playerIds: ids(6) }))).toBeNull();
    expect(tournamentProblem(setup({ format: 'league', playerIds: ids(3), advance: 8 }))).toBeNull();
  });
});
