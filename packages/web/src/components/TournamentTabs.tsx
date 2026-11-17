import { useRef, type KeyboardEvent } from 'react';
import { pl } from '../i18n/pl';

export interface TournamentTab<Id extends string> {
  readonly id: Id;
  readonly label: string;
}

export interface TournamentTabsProps<Id extends string> {
  tabs: readonly TournamentTab<Id>[];
  selected: Id;
  onSelect(id: Id): void;
  tabId(id: Id): string;
  panelId(id: Id): string;
}

// Roving tabindex: Tab wchodzi tylko na wybraną zakładkę, a strzałki przenoszą wybór i fokus.
export function TournamentTabs<Id extends string>({ tabs, selected, onSelect, tabId, panelId }: TournamentTabsProps<Id>) {
  const buttons = useRef(new Map<Id, HTMLButtonElement>());

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    if (next) {
      onSelect(next.id);
      buttons.current.get(next.id)?.focus();
    }
  }

  return (
    <div role="tablist" aria-label={pl.tournamentTabs} className="sc-seg max-w-full self-start">
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              if (element) {
                buttons.current.set(tab.id, element);
              } else {
                buttons.current.delete(tab.id);
              }
            }}
            type="button"
            role="tab"
            id={tabId(tab.id)}
            aria-selected={isSelected}
            aria-controls={isSelected ? panelId(tab.id) : undefined}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(event) => move(event, index)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
