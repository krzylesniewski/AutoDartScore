import { BULL_SEGMENT, MISS_SEGMENT, type Hit } from '@autoscore/schema';
import { pl } from '../i18n/pl';

export function hitLabel(hit: Hit): string {
  if (hit.segment === MISS_SEGMENT) {
    return pl.miss;
  }
  if (hit.segment === BULL_SEGMENT) {
    return hit.multiplier === 2 ? pl.bull : String(BULL_SEGMENT);
  }
  if (hit.multiplier === 2) {
    return `D${hit.segment}`;
  }
  if (hit.multiplier === 3) {
    return `T${hit.segment}`;
  }
  return String(hit.segment);
}
