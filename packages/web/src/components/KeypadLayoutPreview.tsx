import type { KeypadLayout } from '../game/keypad-layout';

const RING_KEYS = Array.from({ length: 20 }, (_, index) => {
  const angle = (index * 18 * Math.PI) / 180;
  return { x: Math.round(115 + 96 * Math.sin(angle)), y: Math.round(115 - 96 * Math.cos(angle)) };
});
const GRID_KEYS = Array.from({ length: 20 }, (_, index) => ({ x: 10 + (index % 10) * 28.4, y: 52 + Math.floor(index / 10) * 44 }));

const key = 'fill-(--color-surface-raised) stroke-(--color-text-muted)';
const bull = 'fill-(--color-surface-raised) stroke-(--color-accent)';

// Szkic klawiatury na karcie wyboru układu. Tylko ozdoba: nazwę układu podaje etykieta obok.
export function KeypadLayoutPreview({ layout }: { layout: KeypadLayout }) {
  if (layout === 'ring') {
    return (
      <svg viewBox="0 0 230 230" aria-hidden="true" focusable="false" className="mx-auto block h-auto w-full max-w-[230px]">
        {RING_KEYS.map(({ x, y }, index) => (
          <circle key={index} cx={x} cy={y} r={13} strokeWidth={1.5} className={key} />
        ))}
        <rect x={70} y={100} width={42} height={30} rx={15} strokeWidth={1.5} className={key} />
        <rect x={118} y={100} width={42} height={30} rx={15} strokeWidth={2} className={bull} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 230" aria-hidden="true" focusable="false" className="mx-auto block h-auto w-full max-w-[300px]">
      {GRID_KEYS.map(({ x, y }, index) => (
        <rect key={index} x={x} y={y} width={24} height={30} rx={6} strokeWidth={1.5} className={key} />
      ))}
      <rect x={10} y={148} width={54} height={30} rx={6} strokeWidth={1.5} className={key} />
      <rect x={70} y={148} width={54} height={30} rx={6} strokeWidth={2} className={bull} />
      <rect x={130} y={148} width={160} height={30} rx={6} strokeWidth={1.5} className={key} />
    </svg>
  );
}
