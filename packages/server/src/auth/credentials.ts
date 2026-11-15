import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthConfig } from '../config.js';

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VERSION = 'v2';

// Klucz zależy też od hasła, więc nowe hasło unieważnia wszystkie wydane tokeny.
function signingKey(auth: AuthConfig): Buffer {
  const passwordDigest = createHash('sha256').update(auth.password).digest();
  return createHmac('sha256', auth.tokenSecret).update(passwordDigest).digest();
}

function sign(auth: AuthConfig, payload: string): string {
  return createHmac('sha256', signingKey(auth)).update(payload).digest('base64url');
}

export function createToken(auth: AuthConfig, expiresAtMs: number): string {
  const payload = `${VERSION}.${expiresAtMs}`;
  return `${payload}.${sign(auth, payload)}`;
}

export function verifyToken(auth: AuthConfig, token: string, nowMs: number): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  const [version, expiry, signature] = parts as [string, string, string];
  if (version !== VERSION || !/^\d+$/.test(expiry)) {
    return false;
  }
  const expiresAtMs = Number(expiry);
  if (!Number.isSafeInteger(expiresAtMs)) {
    return false;
  }
  // Porównujemy napisy, a nie zdekodowane bajty, bo Node dekoduje base64url pobłażliwie i przyjąłby zmieniony podpis.
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(auth, `${version}.${expiry}`));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return false;
  }
  return expiresAtMs > nowMs;
}

// Skróty mają stałą długość, więc hasła różnej długości nie rzucają błędu i nie zdradzają długości czasem.
export function passwordMatches(expected: string, given: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(expected), digest(given));
}
