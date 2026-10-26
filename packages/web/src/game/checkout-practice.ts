import type { CheckoutSession, MatchSnapshot } from '@autoscore/schema';
import { pl } from '../i18n/pl';
import { NO_VALUE } from './format-stat';

type Counts = Pick<CheckoutSession, 'attempts' | 'successes'>;

// Procent udanych prób zaokrąglony do całości. Bez prób nie ma czego liczyć.
export function checkoutPercent({ attempts, successes }: Counts): number | null {
  return attempts === 0 ? null : Math.round((100 * successes) / attempts);
}

export function formatCheckoutPercent(counts: Counts): string {
  const percent = checkoutPercent(counts);
  return percent === null ? NO_VALUE : `${percent}%`;
}

// Nazwa trybu z przedziałem, np. „Końcówki 2-50”, do list gier.
export function checkoutPracticeName(session: CheckoutSession | null): string {
  return session ? pl.checkoutPracticeName(session.range) : pl.checkoutPractice;
}

export interface CheckoutControls {
  readonly results: boolean;
  readonly skip: boolean;
  readonly undo: boolean;
}

// Wynik próby i nowa końcówka wymagają połączenia, bo cel losuje serwer. Cofnij potrzebuje próby albo pominięcia do cofnięcia.
export function checkoutControls(game: Pick<MatchSnapshot, 'status' | 'checkouts'>, connected: boolean): CheckoutControls {
  const inProgress = game.status === 'in_progress';
  const steps = (game.checkouts?.attempts ?? 0) + (game.checkouts?.skips ?? 0);
  return { results: inProgress && connected, skip: inProgress && connected, undo: inProgress && steps > 0 };
}
