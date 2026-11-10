import type { CSSProperties } from 'react';
import { avatarColorClass, avatarColorVar } from '../game/avatar-color';

// Rozmiary paska wyników: poniżej lg wartości z makiety telefonu, od lg z makiet ekranu gry.
const SIZES = {
  small: 'size-9 text-xl',
  medium: 'size-10 text-2xl',
  large: 'size-13 text-3xl',
  tile: 'size-11.5 text-2xl',
  preview: 'size-18 text-[38px]',
  current: 'size-10 text-xl lg:size-[58px] lg:text-[28px]',
  waiting: 'size-8 text-sm lg:size-[46px] lg:text-xl',
  waitingDense: 'size-8 text-sm lg:size-10 lg:text-lg',
  placed: 'size-8 text-sm lg:size-[34px] lg:text-sm',
  compactCurrent: 'size-10 text-xl',
  compactWaiting: 'size-8 text-sm',
} as const;

export type AvatarSize = keyof typeof SIZES;

export interface AvatarProps {
  name: string;
  avatar: string | null;
  color: number; // stały kolor gracza 1-16
  size?: AvatarSize;
  current?: boolean; // pierścień i poświata w kolorze gracza
}

// Imię stoi zawsze obok, więc avatar jest ukryty przed czytnikami ekranu.
export function Avatar({ name, avatar, color, size = 'small', current = false }: AvatarProps) {
  const style = current ? ({ '--sc-avatar-color': avatarColorVar(color) } as CSSProperties) : undefined;
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold text-(--color-on-avatar) ${avatarColorClass(color)} ${SIZES[size]}${current ? ' sc-avatar--current' : ''}`}
      style={style}
    >
      {avatar ?? name.charAt(0).toUpperCase()}
    </span>
  );
}
