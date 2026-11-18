import type { TournamentView } from '@autoscore/schema';
import { tournamentProgress } from '../game/tournament-progress';
import { StandingsTable } from './StandingsTable';
import { TvBracketList } from './TvBracketList';
import { followCardShown, TvFollowCard, type TvPage } from './TvFollowCard';
import { TvNextFixture } from './TvNextFixture';

export interface TvSideColumnProps {
  view: TournamentView;
  page: TvPage;
}

// Od lg kolumna ma wysokość okna. Gdy treść się nie mieści, przewija się sama, a strona nie.
export function TvSideColumn({ view, page }: TvSideColumnProps) {
  const table = view.format === 'league' || tournamentProgress(view).phase === 'group';
  return (
    <div className="flex min-w-0 flex-col gap-(--space-page) lg:min-h-0 lg:overflow-auto">
      {table ? (
        <div className="min-h-0 overflow-auto">
          <StandingsTable view={view} variant="short" />
        </div>
      ) : (
        <TvBracketList view={view} />
      )}
      <TvNextFixture view={view} />
      {followCardShown(view, page) && <TvFollowCard view={view} page={page} />}
    </div>
  );
}
