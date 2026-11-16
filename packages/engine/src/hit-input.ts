import { Hit } from '@autoscore/schema';
import { EngineError } from './errors.js';

// Trafienie z zewnątrz może mieć zły typ mimo sygnatury, więc każdy tryb sprawdza je tutaj.
export function parseHit(input: Hit): Hit {
  const parsed = Hit.safeParse(input);
  if (!parsed.success) {
    throw new EngineError('invalid_hit', `Invalid hit: ${JSON.stringify(input)}`);
  }
  return parsed.data;
}
