import type { RankedPlayer } from '@autoscore/schema';
import { formatAverage } from '../game/format-stat';
import type { PodiumSlot } from '../game/podium';
import { pl } from '../i18n/pl';
import { Avatar } from './Avatar';

export interface PodiumProps {
  slots: readonly PodiumSlot<RankedPlayer>[];
}

// Pełne nazwy klas, żeby Tailwind je znalazł.
const ORDER = { 1: 'order-1', 2: 'order-2', 3: 'order-3' } as const;

const STEPS = {
  1: { block: 'h-28 border-(--color-gold) sm:h-[150px]', place: 'text-(--color-gold)' },
  2: { block: 'h-20 border-(--color-silver) sm:h-[110px]', place: 'text-(--color-silver)' },
  3: { block: 'h-16 border-(--color-bronze) sm:h-[84px]', place: 'text-(--color-bronze)' },
} as const;

function statsHref(playerId: string): string {
  return `#/stats/${encodeURIComponent(playerId)}`;
}

// DOM idzie w kolejności miejsc, żeby czytnik ekranu i klawiatura szły od pierwszego. Klasy order-* stawiają pierwszego na środku.
// Miejsce czyta się z numeru i ukrytego słowa „Miejsce”, a nie z koloru stopnia.
export function Podium({ slots }: PodiumProps) {
  return (
    <div className="relative shrink-0">
      <span aria-hidden="true" className="pointer-events-none absolute -inset-x-6 -top-10 bottom-0 bg-radial-[closest-side] from-(--color-gold)/20 to-transparent" />
      <ol aria-label={pl.podiumLabel} className="relative flex items-end justify-center gap-2 sm:gap-3">
        {slots.map(({ player, step, visualOrder }) => (
          <li key={player.playerId} data-leader={step === 1 || undefined} className={`flex min-w-0 flex-1 sm:max-w-38 ${ORDER[visualOrder]}`}>
            <a href={statsHref(player.playerId)} className="flex w-full min-w-0 flex-col items-center gap-2 text-center text-(--color-text)">
              {step === 1 ? (
                <span className="flex shrink-0 rounded-full ring-2 ring-(--color-gold) ring-offset-4 ring-offset-(--color-surface-raised)">
                  <Avatar name={player.name} avatar={player.avatar} color={player.color} size="preview" />
                </span>
              ) : (
                <Avatar name={player.name} avatar={player.avatar} color={player.color} size="large" />
              )}
              <span className="w-full min-w-0 truncate font-display text-xl leading-tight font-bold sm:text-[22px]">{player.name}</span>
              <span className="shrink-0 font-display text-[30px] leading-none font-black tabular-nums sm:text-[38px]">{formatAverage(player.average)}</span>
              <span
                className={`flex w-full flex-col items-center gap-0.5 rounded-[14px_14px_4px_4px] border-t bg-linear-to-b from-(--color-surface-soft) to-transparent pt-2.5 ${STEPS[step].block}`}
              >
                <span className={`font-display text-[36px] leading-none font-black tabular-nums sm:text-[44px] ${STEPS[step].place}`}>
                  <span className="sr-only">{pl.podiumPlace} </span>
                  {step}
                </span>
                <span className="text-[13px] text-(--color-text-muted)">{pl.legsCount(player.legs)}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
