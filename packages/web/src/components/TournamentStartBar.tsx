import { pl } from '../i18n/pl';
import { TournamentStart, type TournamentStartProps } from './TournamentStart';

// Poniżej lg przycisk stoi poza przewijanym main, tak jak StartBar, więc nie znika z okna.
export function TournamentStartBar(props: TournamentStartProps) {
  return (
    <section
      aria-label={pl.startTournamentBar}
      className="flex shrink-0 flex-col border-t border-(--color-border) bg-linear-to-b from-(--color-bg-mid) to-(--color-bg) px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8"
    >
      <TournamentStart {...props} />
    </section>
  );
}
