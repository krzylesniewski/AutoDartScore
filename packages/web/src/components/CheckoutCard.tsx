import type { Hit, MatchSnapshot } from '@autoscore/schema';
import { checkoutCardShown } from '../game/checkout-card-shown';
import { checkoutRoute } from '../game/checkout-route';
import { hitLabel } from '../game/hit-label';
import { pl } from '../i18n/pl';
import { CardRings } from './CardRings';

export interface CheckoutCardProps {
  state: MatchSnapshot;
  onCheckout(hit: Hit): void;
  disabled: boolean;
}

// Rzutka trasy zamknięcia, wspólna z treningiem końcówek. Rozmiar w cqi idzie za szerokością karty.
export const ROUTE_CHIP =
  'sc-route-chip rounded-(--radius-chip) bg-(--color-route-chip) px-3 font-display text-[clamp(33px,9.5cqi,52px)] leading-none font-extrabold whitespace-nowrap text-(--color-on-accent)';

// Od sm etykieta i trasa mieszczą się w jednym rzędzie. Od lg karta wypełnia wolną wysokość prawej kolumny pod klawiaturą, co najmniej 80 px.
// Tę wysokość daje siatka, a nie treść, więc od lg karta może być kontenerem rozmiaru, a trasa rośnie też z jej wysokością (cqh).
const CARD_BOX =
  '@container lg:@container-size flex w-full flex-col items-start gap-(--space-4) px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:h-full lg:min-h-[80px] lg:pl-(--space-7) lg:pr-20 lg:py-[14px]';
// Biały tekst na jasnym końcu gradientu ma 3,6:1, więc etykieta jest pogrubiona i ma co najmniej 19 px.
// Przy karcie 80 px etykieta ma 19 px, a 3,3cqi trzyma ją przy 19 px aż do karty szerokiej jak przy oknie 1280 px.
const LABEL =
  'relative font-display text-[19px] leading-none font-bold tracking-[0.16em] whitespace-nowrap uppercase lg:text-[length:clamp(19px,min(36.5cqh,3.3cqi),60px)]';
const ROUTE = 'relative flex flex-nowrap gap-(--space-4)';
// Od lg rzutka ma najwyżej wysokość treści karty (przy karcie 80 px to 52 px), a cqi trzyma trzy rzutki obok etykiety w jednym rzędzie.
// Od xl etykieta pokazuje liczbę rzutek i jest ponad dwa razy dłuższa, więc rzutkom zostaje mniejsza część szerokości.
const CARD_CHIP = `${ROUTE_CHIP} lg:text-[length:clamp(33px,min(100cqh,13cqi),160px)] xl:text-[length:clamp(33px,min(100cqh,8.9cqi),160px)]`;

export function CheckoutCard({ state, onCheckout, disabled }: CheckoutCardProps) {
  if (!checkoutCardShown(state)) {
    return null;
  }
  const route = checkoutRoute(state);
  const first = route?.[0];
  // Bez trasy zostaje niewidoczna karta tej samej wysokości, żeby od lg prawa kolumna nie zmieniała układu przy pojawieniu się trasy.
  if (!route || !first) {
    return (
      <div aria-hidden="true" className={`${CARD_BOX} invisible max-lg:hidden`}>
        <span className={LABEL}>{pl.checkout}</span>
        <span className={ROUTE}>
          <span className={CARD_CHIP}>{' '}</span>
        </span>
      </div>
    );
  }
  const labels = route.map(hitLabel);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-keyshortcuts="Enter"
      aria-label={pl.checkoutCardLabel(labels, hitLabel(first))}
      onClick={() => onCheckout(first)}
      className={`sc-checkout ${CARD_BOX} cursor-pointer disabled:cursor-default`}
    >
      <CardRings className="-top-15 -right-15 size-55 text-(--color-on-accent) opacity-(--opacity-checkout-rings) max-lg:-top-11 max-lg:-right-10 max-lg:size-37.5" />
      {/* Poniżej xl długa etykieta zostawiałaby trzem rzutkom za mało miejsca, więc pokazuje się dopiero od xl. */}
      <span className={LABEL}>
        <span className="xl:hidden">{pl.checkout}</span>
        <span className="hidden xl:inline">{pl.checkoutInDarts(route.length)}</span>
      </span>
      <span className={ROUTE}>
        {labels.map((label, index) => (
          <span key={index} className={CARD_CHIP}>
            {label}
          </span>
        ))}
      </span>
      <span aria-hidden="true" className="sc-kbd--on-accent hidden lg:block">
        {pl.shortcutEnter}
      </span>
    </button>
  );
}
