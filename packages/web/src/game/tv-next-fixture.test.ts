import { describe, expect, it } from 'vitest';
import { computedView, playedResults, tournamentConfig } from '../test/snapshots';
import { tvNextFixture } from './tv-next-fixture';

const CUP_4 = tournamentConfig('cup', 4, { thirdPlaceMatch: true });

describe('tvNextFixture', () => {
  it('returns the next fixture of the view', () => {
    const view = computedView(CUP_4, { 'p-sf-1': [1, 0] });
    expect(view.nextFixtureId).toBe('p-sf-2');
    expect(tvNextFixture(view)?.id).toBe('p-sf-2');
  });

  it('falls back to the lowest-numbered waiting fixture when nothing is ready', () => {
    const view = computedView(CUP_4, { 'p-sf-1': [3, 1], 'p-sf-2': [1, 1] });
    expect(view.nextFixtureId).toBeNull();
    expect(tvNextFixture(view)?.id).toBe('p-3rd');
  });

  it('returns null when no fixture is ready or waiting', () => {
    const view = computedView(CUP_4, playedResults(CUP_4));
    expect(view.status).toBe('finished');
    expect(tvNextFixture(view)).toBeNull();
  });
});
