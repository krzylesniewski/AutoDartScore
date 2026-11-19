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

export type TournamentErrorCode = 'invalid_withdrawal' | 'invalid_correction' | 'dependent_started';

// Odrzucona komenda turnieju. Nie dziedziczy po EngineError, bo serwer mapuje kody EngineError zamkniętą listą.
export class TournamentError extends Error {
  constructor(
    readonly code: TournamentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TournamentError';
  }
}
