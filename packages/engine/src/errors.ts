export type EngineErrorCode = 'invalid_config' | 'invalid_hit' | 'match_finished';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}
