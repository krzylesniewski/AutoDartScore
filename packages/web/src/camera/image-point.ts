import type { ImagePoint } from '@autoscore/schema';
import type { ImageSize } from './calibration-steps';

export interface DisplayRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

// Obraz jest pokazany w swoich proporcjach, więc każda oś skaluje się osobno do pikseli oryginału.
export function clientToImagePoint(clientX: number, clientY: number, rect: DisplayRect, naturalSize: ImageSize): ImagePoint {
  return {
    x: toImageAxis(clientX - rect.left, rect.width, naturalSize.width),
    y: toImageAxis(clientY - rect.top, rect.height, naturalSize.height),
  };
}

function toImageAxis(offset: number, displayed: number, natural: number): number {
  const value = displayed > 0 ? (offset / displayed) * natural : 0;
  return Math.round(Math.min(Math.max(value, 0), natural) * 10) / 10;
}
