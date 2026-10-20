import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;

const VERSION = 'v1';

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createToken(secret: string, expiresAtMs: number): string {
  const payload = `${VERSION}.${expiresAtMs}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyToken(secret: string, token: string, nowMs: number): boolean {
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
  const expected = Buffer.from(sign(secret, `${version}.${expiry}`));
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
