import { useState } from 'react';
import { readVoiceEnabled } from '../audio/use-announcer';
import { pl } from '../i18n/pl';
import { AppMark } from './AppMark';

export type AppPage = 'new-game' | 'stats' | 'history' | 'settings';

const LINKS: readonly { page: AppPage; href: string; label: string }[] = [
  { page: 'new-game', href: '#/', label: pl.newGame },
  { page: 'stats', href: '#/stats', label: pl.stats },
  { page: 'history', href: '#/history', label: pl.history },
  { page: 'settings', href: '#/settings', label: pl.settings },
];

export interface AppNavProps {
  current: AppPage;
  // Podaje go tylko ekran, który sam przełącza głos. Inne ekrany go nie zmieniają, więc wystarcza im odczyt przy wejściu.
  voiceEnabled?: boolean;
}

// Od lg jeden wiersz 68 px. Poniżej lg nawigacja przechodzi do drugiego wiersza, a statusy stają w kolumnie bez tła.
export function AppNav({ current, voiceEnabled: shownVoice }: AppNavProps) {
  const [storedVoice] = useState(readVoiceEnabled);
  const voiceEnabled = shownVoice ?? storedVoice;

  return (
    <header className="sc-appbar shrink-0 flex-wrap border-b border-(--color-border) pt-[env(safe-area-inset-top)] max-lg:gap-x-2.5 max-lg:gap-y-0 max-lg:px-4 lg:h-17 lg:flex-nowrap">
      <AppMark className="size-[26px] lg:size-8" />
      <span className="flex h-12 items-center font-display text-[20px] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase lg:mr-4.5 lg:h-auto lg:text-[24px]">
        {pl.appName}
      </span>
      <nav
        aria-label={pl.mainNav}
        className="sc-nav flex-wrap font-display max-lg:order-last max-lg:-mx-2.5 max-lg:h-11 max-lg:w-[calc(100%+20px)] max-lg:justify-between max-lg:gap-0"
      >
        {LINKS.map((link) => (
          <a
            key={link.page}
            href={link.href}
            aria-current={current === link.page ? 'page' : undefined}
            className={`min-h-11 px-2.5 text-[18px] whitespace-nowrap lg:px-4 lg:text-[20px] ${current === link.page ? 'font-bold text-(--color-text)' : 'font-semibold text-(--color-text-muted)'}`}
          >
            {link.label}
          </a>
        ))}
      </nav>
      <span aria-hidden="true" className="grow" />
      <div className="flex shrink-0 gap-3 max-lg:flex-col max-lg:items-end max-lg:gap-0.75">
        <Status on={false} text={pl.cameraNone} />
        <Status on={voiceEnabled} text={pl.voiceStatus(voiceEnabled)} />
      </div>
    </header>
  );
}

// Kolor kropki nie niesie stanu sam: włączony ma wypełnienie, wyłączony pusty pierścień, a tekst obok mówi to wprost.
function Status({ on, text }: { on: boolean; text: string }) {
  return (
    <span className="sc-status leading-tight whitespace-nowrap max-lg:gap-1.5 max-lg:bg-transparent max-lg:p-0 max-lg:text-[13px]">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full lg:size-2.5 ${on ? 'bg-(--color-status-ok)' : 'border-2 border-(--color-text-muted)'}`} />
      <span>{text}</span>
    </span>
  );
}
