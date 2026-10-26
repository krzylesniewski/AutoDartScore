import { EngineError } from '@autoscore/engine';
import type { ApiError } from '@autoscore/schema';

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function invalidRequest(issues: readonly { path: readonly PropertyKey[]; message: string }[]): HttpError {
  const details = issues.map((issue) => (issue.path.length > 0 ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message));
  return new HttpError(400, 'invalid_request', `Invalid request: ${details.join(', ')}`);
}

export function notFound(what: string): HttpError {
  return new HttpError(404, 'not_found', `${what} not found`);
}

export function playerNameTaken(name: string): HttpError {
  return new HttpError(409, 'player_name_taken', `Player name ${name} is already taken`);
}

export function unauthorized(): HttpError {
  return new HttpError(401, 'unauthorized', 'Missing or invalid token');
}

const engineStatus = {
  invalid_hit: [400, 'invalid_request'],
  invalid_config: [400, 'invalid_config'],
  match_finished: [409, 'match_finished'],
  wrong_mode: [409, 'wrong_mode'],
} as const;

function isClientError(error: unknown): error is { statusCode: number; message: string } {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return false;
  }
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

export function toApiError(error: unknown): { statusCode: number; body: ApiError } {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, body: { error: error.code, message: error.message } };
  }
  if (error instanceof EngineError) {
    const [statusCode, code] = engineStatus[error.code];
    return { statusCode, body: { error: code, message: error.message } };
  }
  // Błędy Fastify po stronie klienta, np. niepoprawny JSON, zły typ treści albo za duże body.
  if (isClientError(error)) {
    return { statusCode: 400, body: { error: 'invalid_request', message: error.message } };
  }
  return { statusCode: 500, body: { error: 'internal_error', message: 'Internal server error' } };
}
