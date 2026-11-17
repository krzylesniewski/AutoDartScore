import { CommandRequest } from '@autoscore/schema';
import type { FastifyInstance } from 'fastify';
import { invalidRequest } from '../errors.js';

// Komendy, które czytają z body tylko expectedSeq. Parser w zakresie z lenientCommands czyta body jako JSON przy każdym
// typie treści. Pusty albo zepsuty JSON i wartość, która nie jest obiektem, znaczą brak body, więc nie dają błędu 400.
// Obiekt musi przejść CommandRequest.
export function lenientCommands(scope: FastifyInstance): void {
  scope.removeAllContentTypeParsers();
  scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, lenientJson(body)));
}

function lenientJson(body: Buffer | string): unknown {
  try {
    return JSON.parse(typeof body === 'string' ? body : body.toString('utf8'));
  } catch {
    return undefined;
  }
}

export function commandSeq(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  const parsed = CommandRequest.safeParse(body);
  if (!parsed.success) {
    throw invalidRequest(parsed.error.issues);
  }
  return parsed.data.expectedSeq;
}
