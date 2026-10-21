// Pełne nazwy klas, bo Tailwind generuje CSS tylko dla klas zapisanych dosłownie.
const AVATAR_COLORS = [
  'bg-(--color-avatar-1)',
  'bg-(--color-avatar-2)',
  'bg-(--color-avatar-3)',
  'bg-(--color-avatar-4)',
  'bg-(--color-avatar-5)',
  'bg-(--color-avatar-6)',
  'bg-(--color-avatar-7)',
  'bg-(--color-avatar-8)',
  'bg-(--color-avatar-9)',
  'bg-(--color-avatar-10)',
  'bg-(--color-avatar-11)',
  'bg-(--color-avatar-12)',
  'bg-(--color-avatar-13)',
  'bg-(--color-avatar-14)',
  'bg-(--color-avatar-15)',
  'bg-(--color-avatar-16)',
] as const;

// Kolor gracza to numer 1-16. Wartość spoza zakresu dostaje kolor 1.
export function avatarColorClass(color: number): string {
  return AVATAR_COLORS[color - 1] ?? AVATAR_COLORS[0];
}
