export type EngineErrorCode = 'invalid_config' | 'invalid_hit' | 'match_finished' | 'wrong_mode';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
