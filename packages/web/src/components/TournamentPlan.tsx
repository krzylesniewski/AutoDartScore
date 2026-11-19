import type { TournamentConfig } from '@autoscore/schema';
import { tournamentPlan } from '../game/tournament-plan';
import { tournamentProblem, type TournamentProblem, type TournamentSetup } from '../game/tournament-setup';
import { pl } from '../i18n/pl';
import { CornerRings } from './CornerRings';
import { TournamentStart, type TournamentStartProps } from './TournamentStart';
import { TournamentToggle } from './TournamentToggle';
import { WarningIcon } from './icons';

export interface TournamentPlanProps {
  setup: TournamentSetup;
  // Żądanie po CreateTournamentRequest.safeParse, null gdy nie przeszło.
  config: TournamentConfig | null;
  onSharingChange(sharing: boolean): void;
  // null, gdy przycisk stoi w pasku pod ekranem.
  start: TournamentStartProps | null;
}

const label = 'font-display text-(length:--text-label) font-bold uppercase tracking-[0.18em] text-(--color-text-muted)';

function problemText(problem: TournamentProblem | null, setup: TournamentSetup): string {
  switch (problem?.kind) {
    case 'advance':
      return pl.advanceTooHigh;
    case 'name':
      return pl.tournamentNameRequired;
    case 'players':
      return pl.tournamentPlayerCount(problem.min, problem.max);
    default:
      return setup.name.trim() === '' ? pl.tournamentNameRequired : pl.invalidRequest;
  }
}

export function TournamentPlan({ setup, config, onSharingChange, start }: TournamentPlanProps) {
  const plan = config ? tournamentPlan(config) : null;
  return (
    <section aria-labelledby="tournament-plan" className="sc-panel shrink-0 px-4.5 py-4 sm:px-5.5 sm:py-5">
      <CornerRings className="-top-22.5 -right-20 size-65" />
      <h2 id="tournament-plan" className={`relative ${label}`}>
        {pl.tournamentPlan}
      </h2>
      {plan ? (
        // Bez odstępu między kolumnami, żeby kreska nad sumą szła przez cały wiersz.
        <dl className="relative grid grid-cols-[1fr_auto] gap-y-2 text-[17px]">
          {plan.rows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-(--color-text-sub)">{row.label}</dt>
              <dd className="pl-6 text-right font-display text-xl font-bold tabular-nums">{row.count}</dd>
            </div>
          ))}
          <div className="contents">
            <dt className="border-t border-(--color-border) pt-2.5 font-display text-xl font-bold">{pl.totalMatches}</dt>
            <dd className="border-t border-(--color-border) pt-2.5 pl-6 text-right font-display text-3xl leading-none font-black tabular-nums">
              {plan.total}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="relative flex items-center gap-2 font-display text-lg text-(--color-text)">
          <WarningIcon className="shrink-0 text-(--color-accent)" />
          {problemText(tournamentProblem(setup), setup)}
        </p>
      )}
      <p className="relative text-[15px] text-(--color-text-muted)">{pl.tournamentRulesLine(setup.startingScore)}</p>
      <div className="relative">
        <TournamentToggle name={pl.sharing} hint={pl.sharingHint} enabled={setup.sharing} onChange={onSharingChange} />
      </div>
      {start && (
        <div className="relative">
          <TournamentStart {...start} />
        </div>
      )}
    </section>
  );
}
