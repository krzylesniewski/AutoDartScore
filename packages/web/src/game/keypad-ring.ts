// Promień okręgu przez środki klawiszy, w procentach boku koła.
export const RING_RADIUS_PERCENT = 43;
// Bok klawisza to max(MIN_KEY_PX, RING_KEY_PERCENT) boku koła.
export const RING_KEY_PERCENT = 12.5;
export const MIN_KEY_PX = 44;
// 25 i Bull razem w środku koła. Wysokość ma też dolną granicę MIN_KEY_PX.
export const RING_CENTER_WIDTH_PERCENT = 50;
export const RING_CENTER_HEIGHT_PERCENT = 13;

const STEP_DEGREES = 360 / 20;

// Środek klawisza w procentach boku koła. Indeks 0 jest na górze, kolejne idą zgodnie z ruchem wskazówek zegara.
export function ringKeyPosition(index: number): { left: number; top: number } {
  const angle = ((-90 + index * STEP_DEGREES) * Math.PI) / 180;
  return { left: 50 + RING_RADIUS_PERCENT * Math.cos(angle), top: 50 + RING_RADIUS_PERCENT * Math.sin(angle) };
}
