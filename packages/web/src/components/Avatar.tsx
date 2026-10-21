import { avatarColorClass } from '../game/avatar-color';

const SIZES = {
  small: 'size-9 text-xl',
  medium: 'size-10 text-2xl',
  large: 'size-13 text-3xl',
  tile: 'size-11.5 text-2xl',
  preview: 'size-18 text-[38px]',
} as const;

export interface AvatarProps {
  name: string;
  avatar: string | null;
  color: number; // stały kolor gracza 1-16
  size?: keyof typeof SIZES;
}

// Imię stoi zawsze obok, więc avatar jest ukryty przed czytnikami ekranu.
export function Avatar({ name, avatar, color, size = 'small' }: AvatarProps) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold text-(--color-on-avatar) ${avatarColorClass(color)} ${SIZES[size]}`}>
      {avatar ?? name.charAt(0).toUpperCase()}
    </span>
  );
}
