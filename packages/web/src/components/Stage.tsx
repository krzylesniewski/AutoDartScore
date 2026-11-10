import type { ReactNode } from 'react';

type StageLight = 'game' | 'list' | 'center';

const ringRadii = [490, 455, 430, 270, 252];

export function Stage({ light, children }: { light: StageLight; children: ReactNode }) {
  return (
    <div className="sc-stage" data-stage-light={light}>
      <svg className="sc-stage__rings" aria-hidden="true" focusable="false" pointerEvents="none" viewBox="-500 -500 1000 1000">
        {ringRadii.map((r) => (
          <circle key={r} r={r} vectorEffect="non-scaling-stroke" strokeWidth={1} />
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <line key={i} x1="0" y1="-275" x2="0" y2="-490" transform={`rotate(${9 + 18 * i})`} vectorEffect="non-scaling-stroke" strokeWidth={1} />
        ))}
      </svg>
      <div className="sc-stage__content">{children}</div>
    </div>
  );
}
