import type { PublicTournamentView, TournamentView } from '@autoscore/schema';
import { isLocalAddress, publicTournamentUrl } from '../game/share-url';
import { pl } from '../i18n/pl';
import { QrCode } from './QrCode';

export type TvPage = Pick<Location, 'hostname' | 'origin' | 'pathname'>;

export interface TvFollowCardProps {
  view: PublicTournamentView;
  page: TvPage;
}

// Link z localhost nie otworzy się na telefonie, więc wtedy nie ma ani karty, ani komunikatu.
export function followCardShown(view: TournamentView, page: TvPage): boolean {
  return view.sharing && view.archivedAt === null && !isLocalAddress(page.hostname);
}

export function TvFollowCard({ view, page }: TvFollowCardProps) {
  return (
    <section aria-label={pl.tvFollowTitle} className="sc-panel shrink-0 flex-row items-center gap-5">
      <QrCode value={publicTournamentUrl(page, view.id)} size="tv" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-display text-[28px] leading-[1.05] font-extrabold">{pl.tvFollowTitle}</p>
        <p className="text-base text-(--color-text-muted)">{pl.tvFollowText}</p>
      </div>
    </section>
  );
}
