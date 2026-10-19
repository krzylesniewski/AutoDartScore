import { useState } from 'react';
import { readVoiceEnabled } from '../audio/use-announcer';
import { pl } from '../i18n/pl';
import { TargetIcon } from './icons';

export type AppPage = 'new-game' | 'stats' | 'history';

const LINKS: readonly { page: AppPage; href: string; label: string }[] = [
  { page: 'new-game', href: '#/', label: pl.newGame },
  { page: 'stats', href: '#/stats', label: pl.stats },
  { page: 'history', href: '#/history', label: pl.history },
];

const item = 'flex min-h-11 items-center rounded-(--radius-chip) px-3 sm:px-4';

export function AppNav({ current }: { current: AppPage }) {
  // Głos przełącza się na ekranie gry, więc tutaj wystarcza odczyt przy wejściu na ekran.
  const [voiceEnabled] = useState(readVoiceEnabled);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-9 gap-y-2 border-b border-(--color-border-subtle) bg-(--color-surface-header) px-4 pt-[env(safe-area-inset-top)] min-h-16 sm:px-7">
      <div className="flex flex-wrap items-center gap-x-9 gap-y-2">
        <span className="flex items-center gap-3 font-display text-(length:--text-heading) font-bold tracking-wide">
          <TargetIcon className="text-(--color-accent)" />
          {pl.appName}
        </span>
        <nav aria-label={pl.mainNav} className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold sm:text-xl">
          {LINKS.map((link) => (
            <a
              key={link.page}
              href={link.href}
              aria-current={current === link.page ? 'page' : undefined}
              className={`${item} ${current === link.page ? 'bg-(--color-text) text-(--color-text-inverse)' : 'text-(--color-text-muted)'}`}
            >
              {link.label}
            </a>
          ))}
          <span aria-disabled="true" className={`${item} gap-2 text-(--color-text-muted) opacity-60`}>
            {pl.settings}
            <span className="text-sm uppercase">{pl.soon}</span>
          </span>
        </nav>
      </div>
      <div className="flex items-center gap-5 text-base text-(--color-text-muted)">
        <Status on={false} text={pl.cameraNone} />
        <Status on={voiceEnabled} text={pl.voiceStatus(voiceEnabled)} />
      </div>
    </header>
  );
}

function Status({ on, text }: { on: boolean; text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={`size-2.5 rounded-full ${on ? 'bg-(--color-status-ok)' : 'bg-(--color-text-muted)'}`} />
      {text}
    </span>
  );
}
