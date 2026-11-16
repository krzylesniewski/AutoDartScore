import type { DomainEvent } from '@autoscore/schema';
import type { ApplyResult } from './apply-result.js';

// Stan jako wynik odtworzenia wszystkich kroków z logu (zapis zdarzeniowy).
export function replaySteps<S, I>(initial: S, inputs: readonly I[], apply: (state: S, input: I) => ApplyResult<S>): ApplyResult<S> {
  let state = initial;
  const events: DomainEvent[] = [];
  for (const input of inputs) {
    const result = apply(state, input);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
