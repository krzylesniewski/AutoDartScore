import type { DomainEvent } from '@autoscore/schema';

export interface ApplyResult<S> {
  readonly state: S;
  readonly events: readonly DomainEvent[];
}
