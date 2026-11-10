// Pełne nazwy klas, bo Tailwind generuje CSS tylko dla klas zapisanych dosłownie.
const RINGS = [
  'ring-(--color-avatar-1)',
  'ring-(--color-avatar-2)',
  'ring-(--color-avatar-3)',
  'ring-(--color-avatar-4)',
  'ring-(--color-avatar-5)',
  'ring-(--color-avatar-6)',
  'ring-(--color-avatar-7)',
  'ring-(--color-avatar-8)',
  'ring-(--color-avatar-9)',
  'ring-(--color-avatar-10)',
  'ring-(--color-avatar-11)',
  'ring-(--color-avatar-12)',
  'ring-(--color-avatar-13)',
  'ring-(--color-avatar-14)',
  'ring-(--color-avatar-15)',
  'ring-(--color-avatar-16)',
] as const;

const INSET_RINGS = [
  'inset-ring-(--color-avatar-1)',
  'inset-ring-(--color-avatar-2)',
  'inset-ring-(--color-avatar-3)',
  'inset-ring-(--color-avatar-4)',
  'inset-ring-(--color-avatar-5)',
  'inset-ring-(--color-avatar-6)',
  'inset-ring-(--color-avatar-7)',
  'inset-ring-(--color-avatar-8)',
  'inset-ring-(--color-avatar-9)',
  'inset-ring-(--color-avatar-10)',
  'inset-ring-(--color-avatar-11)',
  'inset-ring-(--color-avatar-12)',
  'inset-ring-(--color-avatar-13)',
  'inset-ring-(--color-avatar-14)',
  'inset-ring-(--color-avatar-15)',
  'inset-ring-(--color-avatar-16)',
] as const;

// Obwódka w kolorze gracza, z tym samym zastępczym kolorem 1 co avatarColorClass.
export function avatarRingClasses(color: number): { ring: string; insetRing: string } {
  return { ring: RINGS[color - 1] ?? RINGS[0], insetRing: INSET_RINGS[color - 1] ?? INSET_RINGS[0] };
}
