import type { Fixture, TournamentView } from '@autoscore/schema';

export type CrossCell =
  | { readonly kind: 'self' }
  | { readonly kind: 'result'; readonly legs: readonly [number, number]; readonly fixture: Fixture }
  | { readonly kind: 'pending'; readonly fixture: Fixture }
  | { readonly kind: 'none' };

function playerIn(fixture: Fixture, slot: 0 | 1): string | null {
  const entry = fixture.slots[slot];
  return entry.kind === 'player' ? entry.playerId : null;
}

// Legi zawsze od strony gracza z wiersza, więc komórki po obu stronach przekątnej są swoim odbiciem.
export function crossCell(view: TournamentView, rowPlayerId: string, columnPlayerId: string): CrossCell {
  if (rowPlayerId === columnPlayerId) {
    return { kind: 'self' };
  }
  for (const fixture of view.fixtures) {
    if (fixture.phase !== 'group') {
      continue;
    }
    const first = playerIn(fixture, 0);
    const second = playerIn(fixture, 1);
    const straight = first === rowPlayerId && second === columnPlayerId;
    const reversed = first === columnPlayerId && second === rowPlayerId;
    if (!straight && !reversed) {
      continue;
    }
    if (fixture.result !== null && (fixture.status === 'finished' || fixture.status === 'walkover')) {
      const [own, other] = fixture.result.legs;
      return { kind: 'result', legs: straight ? [own, other] : [other, own], fixture };
    }
    return { kind: 'pending', fixture };
  }
  return { kind: 'none' };
}

export function highlightedFixtureId(view: TournamentView): string | null {
  return view.liveFixtureId ?? view.nextFixtureId;
}
