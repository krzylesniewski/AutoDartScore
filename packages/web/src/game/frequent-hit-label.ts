import { BULL_SEGMENT, type Hit } from '@autoscore/schema';
import { pl } from '../i18n/pl';

// W rzędzie najczęstszych trafień single ma literę S, bo klik wysyła trafienie bez względu na przełącznik S/D/T.
export function frequentHitLabel(hit: Hit): string {
  if (hit.segment === BULL_SEGMENT) {
    return hit.multiplier === 2 ? pl.bull : String(BULL_SEGMENT);
  }
  if (hit.multiplier === 2) {
    return `D${hit.segment}`;
  }
  if (hit.multiplier === 3) {
    return `T${hit.segment}`;
  }
  return `S${hit.segment}`;
}
