import type { Banner } from '../api/use-match';
import { pl } from '../i18n/pl';
import { BustIcon, TrophyIcon } from './icons';

// Nakładka nad kolumną tury, żeby nie przesuwała układu i nie łapała dotyku.
// Region role="status" istnieje stale, żeby czytnik ekranu odczytał zmianę.
export function EventBanner({ banner }: { banner: Banner | null }) {
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-0 z-10">
      {banner && (
        <p
          className={`flex animate-banner-in items-center gap-3 rounded-(--radius-card) px-5 py-3 font-display text-4xl font-bold uppercase motion-reduce:animate-none ${
            banner.kind === 'bust' ? 'bg-(--color-accent) text-(--color-on-accent)' : 'bg-(--color-text) text-(--color-text-inverse)'
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
