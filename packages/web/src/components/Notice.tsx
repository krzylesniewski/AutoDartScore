import type { ReactNode } from 'react';
import { WarningIcon } from './icons';

export interface NoticeProps {
  text: string;
  tone?: 'alert' | 'status';
  appearance?: 'plain' | 'raised' | 'soft';
  icon?: ReactNode;
  children?: ReactNode;
}

const APPEARANCE = {
  plain: 'flex items-center gap-2 font-display text-lg text-(--color-text)',
  // Od lg komunikat leży na panelu tury, więc tło musi być kryjące.
  raised:
    'flex items-center gap-2 rounded-(--radius-card) bg-linear-to-b from-(--color-surface-raised) to-(--color-surface) px-4 py-2 font-display text-xl text-(--color-text) shadow-(--shadow-card)',
  soft: 'flex items-center gap-2 rounded-(--radius-card) bg-(--color-surface-soft) px-4 py-2 font-display text-xl text-(--color-text)',
} as const;

// Komunikat: ikona i tekst, nie sam kolor. Akcent zostaje na ikonie, bo jako tekst na karcie ma za mały kontrast.
export function Notice({ text, tone = 'alert', appearance = 'plain', icon = <WarningIcon className="text-(--color-accent)" />, children }: NoticeProps) {
  return (
    <p role={tone} className={APPEARANCE[appearance]}>
      {icon}
      {text}
      {children}
    </p>
  );
}
