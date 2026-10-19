// Pełne nazwy klas, bo Tailwind generuje CSS tylko dla klas zapisanych dosłownie.
const AVATAR_COLORS = ['bg-(--color-avatar-1)', 'bg-(--color-avatar-2)', 'bg-(--color-avatar-3)', 'bg-(--color-avatar-4)'] as const;

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
  colorIndex: number;
  size?: keyof typeof SIZES;
}

// Imię stoi zawsze obok, więc avatar jest ukryty przed czytnikami ekranu.
export function Avatar({ name, avatar, colorIndex, size = 'small' }: AvatarProps) {
  const color = AVATAR_COLORS[((colorIndex % AVATAR_COLORS.length) + AVATAR_COLORS.length) % AVATAR_COLORS.length];
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold text-(--color-on-avatar) ${color} ${SIZES[size]}`}>
      {avatar ?? name.charAt(0).toUpperCase()}
    </span>
  );
}
