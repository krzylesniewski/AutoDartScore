import type { Hit, MatchSnapshot } from '@autoscore/schema';
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

// Od sm etykieta i trasa mieszczą się w jednym rzędzie. Od lg karta stoi w wąskiej lewej kolumnie, więc etykieta wraca nad trasę.
const CARD_BOX =
  '@container flex w-full flex-col items-start gap-(--space-4) px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-start lg:justify-start lg:px-(--space-7) lg:py-[18px]';
// Biały tekst na jasnym końcu gradientu ma 3,6:1, więc etykieta jest pogrubiona i ma co najmniej 19 px.
const LABEL = 'relative font-display text-[19px] leading-none font-bold tracking-[0.16em] whitespace-nowrap uppercase';
const ROUTE = 'relative flex flex-nowrap gap-(--space-4)';

export function CheckoutCard({ state, onCheckout, disabled }: CheckoutCardProps) {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  if (state.finished || state.startingScore === null || !player || player.remaining === null) {
    return null;
  }
  const route = checkoutRoute(state);
  const first = route?.[0];
  // Bez trasy zostaje niewidoczna karta tej samej wysokości, żeby od lg lewa kolumna nie zmieniała układu przy pojawieniu się trasy.
  if (!route || !first) {
    return (
      <div aria-hidden="true" className={`${CARD_BOX} invisible max-lg:hidden`}>
        <span className={LABEL}>{pl.checkout}</span>
        <span className={ROUTE}>
          <span className={ROUTE_CHIP}>{' '}</span>
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
      {/* Długa etykieta w kolumnie 340 px wchodziłaby pod znaczek Enter, więc pokazuje się dopiero od xl. */}
      <span className={LABEL}>
        <span className="xl:hidden">{pl.checkout}</span>
        <span className="hidden xl:inline">{pl.checkoutInDarts(route.length)}</span>
      </span>
      <span className={ROUTE}>
        {labels.map((label, index) => (
          <span key={index} className={ROUTE_CHIP}>
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
