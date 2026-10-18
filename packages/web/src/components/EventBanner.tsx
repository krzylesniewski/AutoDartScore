import type { Banner } from '../api/use-match';
import { pl } from '../i18n/pl';
import { BustIcon, TrophyIcon } from './icons';

// Pasek nad klawiaturą, nie okno. Region role="status" istnieje stale, żeby czytnik ekranu odczytał zmianę.
export function EventBanner({ banner }: { banner: Banner | null }) {
  return (
    <div role="status" className="min-h-14">
      {banner && (
        <p
          className={`flex items-center gap-3 rounded-card px-4 py-2 font-display text-3xl font-bold uppercase ${
            banner.kind === 'bust' ? 'bg-board-red text-cream' : 'bg-board-green text-cream'
          }`}
        >
          {banner.kind === 'bust' ? <BustIcon /> : <TrophyIcon />}
          <span>{banner.kind === 'bust' ? pl.bust : pl.legWon}</span>
          <span className="normal-case">{banner.playerName}</span>
          {banner.place !== null && <span>{pl.place(banner.place)}</span>}
        </p>
      )}
    </div>
  );
}
