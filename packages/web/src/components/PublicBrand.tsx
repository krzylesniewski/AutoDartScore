import { pl } from '../i18n/pl';
import { AppMark } from './AppMark';

// Pasek publicznego podglądu: znak aplikacji i oznaczenie podglądu, bez nawigacji aplikacji.
export function PublicBrand() {
  return (
    <header className="sc-appbar shrink-0 gap-2.5 border-b border-(--color-border) pt-[env(safe-area-inset-top)] max-lg:px-4 lg:h-17">
      <AppMark className="size-[26px] lg:size-8" />
      <span className="flex h-12 items-center font-display text-[20px] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase lg:h-auto lg:text-[24px]">
        {pl.appName}
      </span>
      <span className="inline-flex min-h-7 items-center rounded-(--radius-pill) bg-(--color-surface-soft) px-3 text-sm whitespace-nowrap text-(--color-text-sub) shadow-(--shadow-inset-line)">
        {pl.publicPreview}
      </span>
    </header>
  );
}
