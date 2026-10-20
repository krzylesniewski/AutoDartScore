import type { Banner } from '../api/use-match';
import { pl } from '../i18n/pl';
import { BustIcon, TrophyIcon } from './icons';

// Nakładka, żeby nie przesuwała układu i nie łapała dotyku. Poniżej lg leży na górze widocznego obszaru pod nagłówkiem
// i nie przewija się z treścią, więc nie zasłania klawiatury ani Cofnij. Od lg leży na górze kolumny tury.
// Region role="status" istnieje stale, żeby czytnik ekranu odczytał zmianę.
export function EventBanner({ banner }: { banner: Banner | null }) {
  return (
    <div role="status" className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-(--space-page) sm:pt-(--space-page) lg:p-0">
      {banner && (
        <p
          className={`flex animate-banner-in flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-card) px-5 py-3 font-display text-3xl font-bold uppercase motion-reduce:animate-none lg:text-4xl ${
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
