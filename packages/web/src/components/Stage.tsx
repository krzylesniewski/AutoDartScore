import type { ReactNode } from 'react';

type StageLight = 'game' | 'list' | 'center';

// Tło sceny to samo światło (gradient), bez pierścieni tarczy (decyzja autora 2026-11-10).
export function Stage({ light, children }: { light: StageLight; children: ReactNode }) {
  return (
    <div className="sc-stage" data-stage-light={light}>
      <div className="sc-stage__content">{children}</div>
    </div>
  );
}
