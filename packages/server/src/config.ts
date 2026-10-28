import path from 'node:path';

export interface AuthConfig {
  readonly password: string;
  readonly tokenSecret: string;
}

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly auth: AuthConfig | null;
  readonly corsOrigins: readonly string[] | null;
  readonly webDir: string | null;
  readonly matchLockMinutes: number;
  readonly pendingConfidence: number;
}

const MIN_TOKEN_SECRET_LENGTH = 32;
// Rok. Większa wartość mogłaby wyprowadzić finishedAt + blokada poza zakres poprawnej daty.
const MAX_MATCH_LOCK_MINUTES = 525_600;

export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    // 0.0.0.0, żeby tablet w sieci lokalnej mógł się połączyć.
    host: env.HOST || '0.0.0.0',
    port: parsePort(env.PORT),
    databasePath: env.DATABASE_PATH || 'autoscore.sqlite',
    auth: parseAuth(env.AUTOSCORE_PASSWORD, env.AUTOSCORE_TOKEN_SECRET),
    corsOrigins: parseCorsOrigins(env.AUTOSCORE_CORS_ORIGIN),
    webDir: parseWebDir(env.AUTOSCORE_WEB_DIR),
    matchLockMinutes: parseMatchLockMinutes(env.AUTOSCORE_MATCH_LOCK_MINUTES),
    pendingConfidence: parsePendingConfidence(env.AUTOSCORE_PENDING_CONFIDENCE),
  };
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 3000;
  }
  const port = Number(value);
  if (!/^\d+$/.test(value) || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

function parseMatchLockMinutes(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 5;
  }
  const minutes = Number(value);
  if (!/^\d+$/.test(value) || minutes > MAX_MATCH_LOCK_MINUTES) {
    throw new Error(`Invalid AUTOSCORE_MATCH_LOCK_MINUTES: ${value}`);
  }
  return minutes;
}

// Rzutka z pewnością poniżej progu czeka na weryfikację. 0 wyłącza weryfikację, 1 wysyła do niej każdą niepewną rzutkę.
function parsePendingConfidence(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 0.8;
  }
  const threshold = Number(value);
  if (!/^\d+(\.\d+)?$/.test(value) || threshold > 1) {
    throw new Error(`Invalid AUTOSCORE_PENDING_CONFIDENCE: ${value}`);
  }
  return threshold;
}

// Ścieżka względna liczy się od katalogu roboczego, pod systemd to packages/server.
function parseWebDir(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : path.resolve(trimmed);
}

// Komunikaty błędów nie zawierają hasła ani sekretu, bo trafiają do logów.
function parseAuth(password: string | undefined, tokenSecret: string | undefined): AuthConfig | null {
  if (!password) {
    return null;
  }
  if (!tokenSecret) {
    throw new Error('Missing AUTOSCORE_TOKEN_SECRET');
  }
  if (tokenSecret.length < MIN_TOKEN_SECRET_LENGTH) {
    throw new Error(`Invalid AUTOSCORE_TOKEN_SECRET: at least ${MIN_TOKEN_SECRET_LENGTH} characters`);
  }
  return { password, tokenSecret };
}

// Przeglądarka wysyła Origin bez ścieżki i bez końcowego ukośnika, więc inny zapis nigdy by nie pasował.
function parseCorsOrigins(value: string | undefined): readonly string[] | null {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  if (entries.length === 0) {
    return null;
  }
  for (const entry of entries) {
    if (originOf(entry) !== entry) {
      throw new Error(`Invalid AUTOSCORE_CORS_ORIGIN: ${entry}`);
    }
  }
  return entries;
}

function originOf(entry: string): string | null {
  try {
    return new URL(entry).origin;
  } catch {
    return null;
  }
}
