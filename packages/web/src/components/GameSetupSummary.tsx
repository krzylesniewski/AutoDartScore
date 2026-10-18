import type { Player } from '@autoscore/schema';
import type { GameSetup } from '../game/game-setup';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface GameSetupSummaryProps {
  setup: GameSetup;
  // Wybrani gracze w kolejności wyboru, z kolorem avatara z listy graczy.
  players: readonly { player: Player; colorIndex: number }[];
}

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

function rows(setup: GameSetup): readonly [string, string][] {
  if (setup.type === 'practice') {
    return [
      [pl.summaryType, pl.typePractice],
      [pl.summaryMode, setup.practiceMode === 'solo_501' ? pl.solo501 : pl.freeRun],
      [pl.summaryRules, setup.practiceMode === 'solo_501' ? pl.rulesX01 : pl.rulesFreeRun],
    ];
  }
  return [
    [pl.summaryType, setup.type === 'match' ? pl.typeMatch : pl.typeCasual],
    [pl.summaryPoints, String(setup.startingScore)],
    [pl.summaryFormat, setup.type === 'match' ? pl.bestOfFormat(setup.bestOf) : pl.casualFormat],
    [pl.summaryRules, pl.rulesX01],
    [pl.summaryStarts, pl.startsByDraw],
  ];
}

// Czysty widok stanu formularza. Nic tu nie trafia do serwera.
export function GameSetupSummary({ setup, players }: GameSetupSummaryProps) {
  const [first, second] = players;
  return (
    <section aria-labelledby="setup-summary" className="flex flex-col gap-4 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) px-7 py-6">
      <h2 id="setup-summary" className={label}>
        {pl.setupSummary}
      </h2>
      {players.length === 0 && <p className="text-xl text-(--color-text-muted)">{pl.noPlayersSelected}</p>}
      {setup.type === 'match' && first && second ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={first.player.name} avatar={first.player.avatar} colorIndex={first.colorIndex} size="large" />
            <span className="truncate text-[26px] font-semibold">{first.player.name}</span>
          </span>
          <span className="font-display text-[22px] font-semibold text-(--color-text-muted)">{pl.versus}</span>
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate text-[26px] font-semibold">{second.player.name}</span>
            <Avatar name={second.player.name} avatar={second.player.avatar} colorIndex={second.colorIndex} size="large" />
          </span>
        </div>
      ) : (
        players.length > 0 && (
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {players.map(({ player, colorIndex }) => (
              <li key={player.id} className="flex items-center gap-2 text-xl font-semibold">
                <Avatar name={player.name} avatar={player.avatar} colorIndex={colorIndex} />
                {player.name}
              </li>
            ))}
          </ul>
        )
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-(--color-border) pt-4 text-[19px]">
        {rows(setup).map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-(--color-text-muted)">{term}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
