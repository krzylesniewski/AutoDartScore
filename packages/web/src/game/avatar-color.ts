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

const AVATAR_STROKES = [
  'stroke-(--color-avatar-1)',
  'stroke-(--color-avatar-2)',
  'stroke-(--color-avatar-3)',
  'stroke-(--color-avatar-4)',
  'stroke-(--color-avatar-5)',
  'stroke-(--color-avatar-6)',
  'stroke-(--color-avatar-7)',
  'stroke-(--color-avatar-8)',
  'stroke-(--color-avatar-9)',
  'stroke-(--color-avatar-10)',
  'stroke-(--color-avatar-11)',
  'stroke-(--color-avatar-12)',
  'stroke-(--color-avatar-13)',
  'stroke-(--color-avatar-14)',
  'stroke-(--color-avatar-15)',
  'stroke-(--color-avatar-16)',
] as const;

// Linia w kolorze gracza, z tym samym zastępczym kolorem 1 co avatarColorClass.
export function avatarStrokeClass(color: number): string {
  return AVATAR_STROKES[color - 1] ?? AVATAR_STROKES[0];
}
