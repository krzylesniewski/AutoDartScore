export type EngineErrorCode =
  | 'invalid_config'
  | 'invalid_hit'
  | 'match_finished'
  | 'wrong_mode'
  | 'turn_pending'
  | 'throw_not_flaggable'
  | 'throw_already_pending'
  | 'throw_not_pending';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
