import { useMemo } from 'react';
import { qrPath } from '../game/qr-path';
import { pl } from '../i18n/pl';

export interface QrCodeProps {
  value: string;
  size?: 'dialog' | 'tv';
}

const FRAMES = {
  dialog: 'block aspect-square w-full max-w-60 min-w-50 shrink-0 rounded-(--radius-chip)',
  tv: 'block size-[150px] shrink-0 rounded-(--radius-chip)',
} as const;

// Jasne tło i ciemne moduły z tokenów motywu: czytniki potrzebują ciemnego kodu na jasnym polu, także w ciemnym motywie.
export function QrCode({ value, size: frame = 'dialog' }: QrCodeProps) {
  const { size, path } = useMemo(() => qrPath(value), [value]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={pl.qrCode} shapeRendering="crispEdges" className={FRAMES[frame]}>
      <rect width={size} height={size} className="fill-(--color-text)" />
      <path d={path} className="fill-(--color-bg)" />
    </svg>
  );
}
