import type { ImagePoint } from '@autoscore/schema';
import { useRef, useState, type PointerEvent, type SyntheticEvent } from 'react';
import type { BoardOverlay } from '../camera/board-overlay';
import type { CalibrationPoints, ImageSize } from '../camera/calibration-steps';
import { clientToImagePoint } from '../camera/image-point';

export interface CalibrationImageProps {
  src: string;
  alt: string;
  naturalSize: ImageSize | null;
  points: CalibrationPoints;
  overlay: BoardOverlay | null;
  canPlace: boolean;
  onLoad(size: ImageSize): void;
  onError(): void;
  onPlace(point: ImagePoint): void;
}

interface Loupe {
  readonly point: ImagePoint;
  readonly displayed: ImageSize;
}

const LOUPE_SIZE = 132;
const LOUPE_ZOOM = 3;
// Lupa nad palcem, żeby go nie zasłaniał. Przy górnej krawędzi obrazu przechodzi pod palec.
const LOUPE_GAP = 56;

export function CalibrationImage({ src, alt, naturalSize, points, overlay, canPlace, onLoad, onError, onPlace }: CalibrationImageProps) {
  const image = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const [loupe, setLoupe] = useState<Loupe | null>(null);

  function track(event: PointerEvent<HTMLDivElement>): Loupe | null {
    const rect = image.current?.getBoundingClientRect();
    if (!rect || !naturalSize) {
      return null;
    }
    return { point: clientToImagePoint(event.clientX, event.clientY, rect, naturalSize), displayed: { width: rect.width, height: rect.height } };
  }

  function handleDown(event: PointerEvent<HTMLDivElement>): void {
    if (!canPlace || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    // jsdom nie ma setPointerCapture.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
    setLoupe(track(event));
  }

  function handleMove(event: PointerEvent<HTMLDivElement>): void {
    if (dragging.current) {
      setLoupe(track(event));
    }
  }

  function handleUp(event: PointerEvent<HTMLDivElement>): void {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    const last = track(event);
    setLoupe(null);
    if (last) {
      onPlace(last.point);
    }
  }

  function handleCancel(): void {
    dragging.current = false;
    setLoupe(null);
  }

  function handleLoad(event: SyntheticEvent<HTMLImageElement>): void {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      onLoad({ width: naturalWidth, height: naturalHeight });
    }
  }

  const unit = naturalSize ? Math.max(naturalSize.width, naturalSize.height) / 40 : 0;

  return (
    <div
      data-testid="calibration-image"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleCancel}
      className={`relative w-fit max-w-full touch-none select-none ${canPlace ? 'cursor-crosshair' : ''}`}
    >
      <img
        ref={image}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={handleLoad}
        onError={onError}
        className="block h-auto max-w-full rounded-(--radius-card) lg:max-h-[calc(100dvh-11rem)]"
      />
      {naturalSize && overlay && (
        <svg
          aria-hidden="true"
          data-testid="calibration-overlay"
          viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
          className="pointer-events-none absolute inset-0 h-full w-full font-display"
        >
          {overlay.rings.map((ring, index) => (
            <path key={index} d={ring} className="fill-none stroke-(--color-accent)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          ))}
          {overlay.wires.map((wire, index) => (
            <line
              key={index}
              x1={wire.from.x}
              y1={wire.from.y}
              x2={wire.to.x}
              y2={wire.to.y}
              className="stroke-(--color-accent)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {overlay.labels.map((label) => (
            <text
              key={label.segment}
              x={label.at.x}
              y={label.at.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={unit}
              fontWeight={700}
              strokeWidth={unit / 6}
              paintOrder="stroke"
              className="fill-(--color-text) stroke-(--color-bg)"
            >
              {label.segment}
            </text>
          ))}
        </svg>
      )}
      {naturalSize &&
        points.map((point, index) =>
          point ? (
            <span
              key={index}
              data-testid={`calibration-marker-${index + 1}`}
              aria-hidden="true"
              style={{ left: `${(point.x / naturalSize.width) * 100}%`, top: `${(point.y / naturalSize.height) * 100}%` }}
              className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--color-accent)"
            >
              <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--color-accent)" />
              <span className="absolute -top-3 left-4 flex size-5 items-center justify-center rounded-full bg-(--color-accent) font-display text-sm leading-none font-bold text-(--color-on-accent)">
                {index + 1}
              </span>
            </span>
          ) : null,
        )}
      {loupe && naturalSize && <LoupeView src={src} loupe={loupe} naturalSize={naturalSize} />}
    </div>
  );
}

function LoupeView({ src, loupe, naturalSize }: { src: string; loupe: Loupe; naturalSize: ImageSize }) {
  const x = (loupe.point.x / naturalSize.width) * loupe.displayed.width;
  const y = (loupe.point.y / naturalSize.height) * loupe.displayed.height;
  const half = LOUPE_SIZE / 2;
  const above = y - LOUPE_GAP - LOUPE_SIZE;
  return (
    <div
      data-testid="calibration-loupe"
      aria-hidden="true"
      style={{
        left: x - half,
        top: above >= 0 ? above : y + LOUPE_GAP,
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        backgroundImage: `url("${src}")`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${loupe.displayed.width * LOUPE_ZOOM}px ${loupe.displayed.height * LOUPE_ZOOM}px`,
        backgroundPosition: `${half - x * LOUPE_ZOOM}px ${half - y * LOUPE_ZOOM}px`,
      }}
      className="pointer-events-none absolute z-10 overflow-hidden rounded-full border-2 border-(--color-text) bg-(--color-bg)"
    >
      <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-(--color-accent)" />
      <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-(--color-accent)" />
    </div>
  );
}
