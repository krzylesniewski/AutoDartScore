import type { LegProgress, MatchLegs, MatchSnapshot } from '@autoscore/schema';
import { useId, useState } from 'react';
import { legProgressFromTurns } from '../game/leg-progress';
import { LegTabList } from './LegTabList';
import { ScoreProgressChart } from './ScoreProgressChart';
import { TurnHistory } from './TurnHistory';

export interface LegReviewProps {
  state: MatchSnapshot;
  // Wykres ostatniego lega z podsumowania. Zostaje, dopóki nie ma historii legów, i w zabawie, która ma jeden leg.
  lastLegProgress: LegProgress | null;
  // Historia legów meczu 1v1. null w zabawie i do pierwszej odpowiedzi.
  legs?: MatchLegs | null | undefined;
}

// Przebieg lega na podsumowaniu: wykres i ta sama tabela tur co w trakcie gry. W meczu na kilka legów zakładki
// wybierają leg dla obu naraz. Bez wyboru pokazany jest ostatni leg.
export function LegReview({ state, lastLegProgress, legs = null }: LegReviewProps) {
  const baseId = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const played = legs?.legs.filter((leg) => leg.turns.length > 0) ?? [];
  const selected = played.find((leg) => leg.legIndex === picked) ?? played.at(-1);
  const names = new Map(state.players.map((player) => [player.id, player.name]));
  const tabId = (legIndex: number) => `${baseId}-tab-${legIndex}`;
  const panelId = `${baseId}-panel`;
  const tabs = played.length > 1;

  const progress = legs && selected ? legProgressFromTurns(selected, legs.startingScore, legs.players) : lastLegProgress;
  const shown: MatchSnapshot = selected ? { ...state, legIndex: selected.legIndex, legTurns: selected.turns } : state;
  if (!progress && shown.legTurns.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {tabs && <LegTabList legs={played} selected={selected} names={names} panelId={panelId} tabId={tabId} onSelect={setPicked} />}
      <div
        id={panelId}
        role={tabs ? 'tabpanel' : undefined}
        aria-labelledby={tabs && selected ? tabId(selected.legIndex) : undefined}
        className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start"
      >
        {progress && <ScoreProgressChart progress={progress} players={state.players} />}
        <div className="sc-panel sc-panel--flat min-w-0 gap-0 px-3 py-2 lg:px-4.5 lg:pt-3 lg:pb-3.5">
          <TurnHistory state={shown} tall />
        </div>
      </div>
    </div>
  );
}
