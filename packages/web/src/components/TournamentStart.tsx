import { pl } from '../i18n/pl';
import { WarningIcon } from './icons';

export interface TournamentStartError {
  text: string;
  // Inny turniej trwa, więc obok błędu stoi link do niego.
  activeTournament: boolean;
}

export interface TournamentStartProps {
  canStart: boolean;
  error: TournamentStartError | null;
  onStart(): void;
}

export function TournamentStart({ canStart, error, onStart }: TournamentStartProps) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-display text-xl font-bold text-(--color-text)">
          <WarningIcon className="text-(--color-accent)" />
          <span className="min-w-0 flex-1">{error.text}</span>
          {error.activeTournament && (
            <a href="#/tournaments" className="inline-flex min-h-11 items-center text-(--color-text) underline underline-offset-4">
              {pl.goToTournament}
            </a>
          )}
        </p>
      )}
      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className="sc-btn sc-btn--primary h-14 w-full shrink-0 rounded-(--radius-card) px-6 font-display text-[26px] font-extrabold tracking-[0.06em] uppercase xl:h-15"
      >
        {pl.startTournament}
      </button>
    </div>
  );
}
