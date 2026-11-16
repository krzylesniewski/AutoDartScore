import { describe, expect, it } from 'vitest';
import { pl } from '../i18n/pl';
import { ApiRequestError } from './client';
import { apiErrorText } from './error-text';

describe('apiErrorText', () => {
  it.each([
    ['a 500 internal_error', new ApiRequestError(500, 'internal_error', 'Internal server error'), pl.requestFailed],
    ['a 400 invalid_request', new ApiRequestError(400, 'invalid_request', 'Invalid request: name: Too big'), pl.invalidRequest],
    ['an invalid_config', new ApiRequestError(400, 'invalid_config', 'Invalid config'), pl.invalidRequest],
    ['an unknown_player', new ApiRequestError(400, 'unknown_player', 'Unknown player p2'), pl.unknownPlayer],
    ['an unknown code', new ApiRequestError(418, 'teapot', 'I am a teapot'), pl.requestFailed],
    ['an unparsed body', new ApiRequestError(502, 'http_error', 'HTTP 502'), pl.requestFailed],
    ['a network TypeError', new TypeError('Failed to fetch'), pl.requestFailed],
  ])('maps %s to Polish text', (_name, caught, text) => {
    expect(apiErrorText(caught)).toBe(text);
  });
});
