import type { ReactNode } from 'react';

export interface StatTileProps {
  label: string;
  value: string | number;
  detail?: string | null | undefined;
  icon?: ReactNode;
}

// Kafelki stoją po trzy w rzędzie w kontenerze .sc-tiles. Każdy jest osobną listą dl, więc etykieta i wartość idą razem.
// Poniżej lg kafelek ma około 85 px treści, więc szczegół (imię) zostaje tylko dla czytnika ekranu, jak w makiecie telefonu.
export function StatTile({ label, value, detail, icon }: StatTileProps) {
  return (
    <dl className="sc-tile max-lg:px-2.5 max-lg:py-1.5">
      <dt className="text-[13px] leading-[1.1] font-medium text-(--color-text-muted)">{label}</dt>
      <dd className="flex min-w-0 items-baseline gap-1.5 font-display text-[22px] leading-none font-extrabold tabular-nums text-(--color-text)">
        {icon && (
          <span aria-hidden="true" className="flex shrink-0 self-center text-base">
            {icon}
          </span>
        )}
        <span className="shrink-0">{value}</span>
        {detail && <span className="min-w-0 truncate font-body text-[13px] font-medium text-(--color-text-muted) max-lg:sr-only">{detail}</span>}
      </dd>
    </dl>
  );
}
