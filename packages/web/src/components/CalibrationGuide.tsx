import { BOARD_RADII, BOARD_SEGMENTS, CALIBRATION_BOARD_POINTS, type Point } from '@autoscore/vision/geometry';
import { pl } from '../i18n/pl';

export interface CalibrationGuideProps {
  active: number | null;
}

const SEGMENT_ANGLE = 360 / BOARD_SEGMENTS.length;
const LABEL_RADIUS = 192;

// Tarcza w mm ma y w górę, a SVG w dół.
function svgPoint(radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}

// Płaski schemat w orientacji tarczy (20 na górze), niezależny od tego, jak kamera ją widzi.
export function CalibrationGuide({ active }: CalibrationGuideProps) {
  const marker = active === null ? null : CALIBRATION_BOARD_POINTS[active];
  return (
    <svg
      role="img"
      aria-label={active === null ? pl.calibrationGuideAll : pl.calibrationGuide(active + 1)}
      viewBox="-218 -218 436 436"
      className="h-auto w-36 shrink-0 font-display sm:w-40"
    >
      <circle r={BOARD_RADII.doubleOuter} className="fill-(--color-surface) stroke-(--color-border-strong)" strokeWidth={2} />
      {[BOARD_RADII.doubleInner, BOARD_RADII.trebleOuter, BOARD_RADII.trebleInner, BOARD_RADII.outerBull, BOARD_RADII.bull].map((radius) => (
        <circle key={radius} r={radius} className="fill-none stroke-(--color-border-strong)" strokeWidth={2} />
      ))}
      {BOARD_SEGMENTS.map((segment, k) => {
        const from = svgPoint(BOARD_RADII.outerBull, SEGMENT_ANGLE / 2 + SEGMENT_ANGLE * k);
        const to = svgPoint(BOARD_RADII.doubleOuter, SEGMENT_ANGLE / 2 + SEGMENT_ANGLE * k);
        const label = svgPoint(LABEL_RADIUS, SEGMENT_ANGLE * k);
        return (
          <g key={segment}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="stroke-(--color-border-strong)" strokeWidth={2} />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={600} className="fill-(--color-text-muted)">
              {segment}
            </text>
          </g>
        );
      })}
      {CALIBRATION_BOARD_POINTS.map((point, index) =>
        index === active ? null : <circle key={index} cx={point.x} cy={-point.y} r={7} className="fill-(--color-text-muted)" />,
      )}
      {marker && active !== null && (
        <g>
          <circle cx={marker.x} cy={-marker.y} r={22} className="fill-(--color-accent) stroke-(--color-text)" strokeWidth={3} />
          <text x={marker.x} y={-marker.y} textAnchor="middle" dominantBaseline="central" fontSize={28} fontWeight={700} className="fill-(--color-on-accent)">
            {active + 1}
          </text>
        </g>
      )}
    </svg>
  );
}
