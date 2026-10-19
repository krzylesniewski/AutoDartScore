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
    <section aria-labelledby="setup-summary" className="flex flex-col gap-3 rounded-(--radius-card) border-(length:--border-width) border-(--color-border) bg-(--color-surface) px-5.5 py-4.5">
      <h2 id="setup-summary" className={label}>
        {pl.setupSummary}
      </h2>
      {players.length === 0 && <p className="text-xl text-(--color-text-muted)">{pl.noPlayersSelected}</p>}
      {players.length === 2 && first && second ? (
        <div className="flex items-center justify-between gap-3">
          <PreviewPlayer entry={first} />
          <span className="font-display text-[40px] font-bold text-(--color-accent) uppercase">{pl.versus}</span>
          <PreviewPlayer entry={second} />
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
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-(--color-border) pt-3 text-[17px]">
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

function PreviewPlayer({ entry: { player, colorIndex } }: { entry: GameSetupSummaryProps['players'][number] }) {
  return (
    <span className="flex w-35 min-w-0 flex-col items-center gap-1.5">
      <Avatar name={player.name} avatar={player.avatar} colorIndex={colorIndex} size="preview" />
      <span className="max-w-full truncate text-[21px] font-semibold">{player.name}</span>
    </span>
  );
}
