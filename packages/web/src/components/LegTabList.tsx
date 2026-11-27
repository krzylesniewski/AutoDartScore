import type { MatchLeg } from '@autoscore/schema';
import { useRef, type KeyboardEvent } from 'react';
import { pl } from '../i18n/pl';

export interface LegTabListProps {
  legs: readonly MatchLeg[];
  selected: MatchLeg | undefined;
  names: ReadonlyMap<string, string>;
  panelId: string;
  tabId(legIndex: number): string;
  onSelect(legIndex: number): void;
}

function tabText(leg: MatchLeg, names: ReadonlyMap<string, string>): string {
  return leg.winnerId === null ? pl.fixtureLive : (names.get(leg.winnerId) ?? '');
}

// Zakładki legów: numer lega i zwycięzca. Strzałki przenoszą zaznaczenie i fokus, jak w zwykłej liście zakładek.
export function LegTabList({ legs, selected, names, panelId, tabId, onSelect }: LegTabListProps) {
  const buttons = useRef(new Map<number, HTMLButtonElement>());

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = legs[(index + step + legs.length) % legs.length];
    if (next) {
      onSelect(next.legIndex);
      buttons.current.get(next.legIndex)?.focus();
    }
  }

  return (
    <div role="tablist" aria-label={pl.legTabs} className="flex flex-wrap gap-2">
      {legs.map((leg, index) => {
        const isSelected = leg === selected;
        return (
          <button
            key={leg.legIndex}
            ref={(element) => {
              if (element) {
                buttons.current.set(leg.legIndex, element);
              } else {
                buttons.current.delete(leg.legIndex);
              }
            }}
            type="button"
            role="tab"
            id={tabId(leg.legIndex)}
            aria-selected={isSelected}
            aria-controls={isSelected ? panelId : undefined}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(leg.legIndex)}
            onKeyDown={(event) => move(event, index)}
            className={`flex min-h-11 min-w-20 flex-col items-center justify-center rounded-(--radius-chip) px-3 py-1.5 leading-tight ${isSelected ? 'bg-(--color-surface-soft) text-(--color-text) inset-ring-2 inset-ring-(--color-accent)' : 'text-(--color-text-sub) shadow-(--shadow-inset-line)'}`}
          >
            <span className="font-display text-lg font-bold">{pl.legNumber(leg.legIndex + 1)}</span>{' '}
            <span className="max-w-28 truncate text-[13px]">{tabText(leg, names)}</span>
          </button>
        );
      })}
    </div>
  );
}
