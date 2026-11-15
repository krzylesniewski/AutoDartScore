import type { CheckoutSession } from '@autoscore/schema';
import { useId } from 'react';
import { formatCheckoutPercent } from '../game/checkout-practice';
import { pl } from '../i18n/pl';
import { AttemptRow } from './CheckoutPracticePanel';

const label = 'font-display text-(length:--text-label) font-semibold uppercase tracking-(--tracking-label) text-(--color-text-muted)';

// Całość pochodzi ze snapshotu, bo sesja końcówek nigdy nie jest „finished” i nie ma podsumowania z serwera.
export function CheckoutPracticeSummary({ session }: { session: CheckoutSession }) {
  const id = useId();
  const totals = [
    [pl.checkoutAttempts, String(session.attempts)],
    [pl.checkoutSuccesses, String(session.successes)],
    [pl.checkoutPercent, formatCheckoutPercent(session)],
  ] as const;
  return (
    <section aria-labelledby={id} className="sc-panel gap-4 lg:px-6">
      <h2 id={id} className="font-display text-(length:--text-heading) leading-tight font-bold">
        {pl.checkoutSummary}
      </h2>
      <dl className="grid grid-cols-3 gap-3">
        {totals.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className={label}>{term}</dt>
            <dd className="font-display text-[30px] leading-none font-extrabold tabular-nums lg:text-4xl">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className={label}>{pl.checkoutAllAttempts}</h3>
      <ol className="flex flex-col">
        {session.history.map((attempt, index) => (
          <AttemptRow key={index} attempt={attempt} number={index + 1} className="min-h-9" />
        ))}
      </ol>
    </section>
  );
}
