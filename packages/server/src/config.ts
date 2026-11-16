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
  readonly trustProxy: boolean;
}

type AuthMode = 'on' | 'off';

const MIN_TOKEN_SECRET_LENGTH = 32;
// Hasło z deploy/autoscore.env.example. Nietknięta kopia wzoru nie może otworzyć serwera.
const EXAMPLE_PASSWORD = 'zmien-to-haslo';
// Rok. Większa wartość mogłaby wyprowadzić finishedAt + blokada poza zakres poprawnej daty.
const MAX_MATCH_LOCK_MINUTES = 525_600;

export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    // 0.0.0.0, żeby tablet w sieci lokalnej mógł się połączyć.
    host: env.HOST || '0.0.0.0',
    port: parsePort(env.PORT),
    databasePath: env.DATABASE_PATH || 'autoscore.sqlite',
    auth: parseAuth(parseAuthMode(env.AUTOSCORE_AUTH), env.AUTOSCORE_PASSWORD, env.AUTOSCORE_TOKEN_SECRET),
    corsOrigins: parseCorsOrigins(env.AUTOSCORE_CORS_ORIGIN),
    webDir: parseWebDir(env.AUTOSCORE_WEB_DIR),
    matchLockMinutes: parseMatchLockMinutes(env.AUTOSCORE_MATCH_LOCK_MINUTES),
    trustProxy: parseTrustProxy(env.AUTOSCORE_TRUST_PROXY),
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

// Ścieżka względna liczy się od katalogu roboczego, pod systemd to packages/server.
function parseWebDir(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : path.resolve(trimmed);
}

function parseAuthMode(value: string | undefined): AuthMode {
  const mode = (value ?? '').trim();
  if (mode === '' || mode === 'on') {
    return 'on';
  }
  if (mode === 'off') {
    return 'off';
  }
  throw new Error(`Invalid AUTOSCORE_AUTH: ${mode}`);
}

function parseTrustProxy(value: string | undefined): boolean {
  const mode = (value ?? '').trim();
  if (mode === '' || mode === 'off') {
    return false;
  }
  if (mode === 'on') {
    return true;
  }
  throw new Error(`Invalid AUTOSCORE_TRUST_PROXY: ${mode}`);
}

// Komunikaty błędów nie zawierają hasła ani sekretu, bo trafiają do logów.
function parseAuth(mode: AuthMode, password: string | undefined, tokenSecret: string | undefined): AuthConfig | null {
  if (mode === 'off') {
    if (password) {
      throw new Error('AUTOSCORE_AUTH=off conflicts with AUTOSCORE_PASSWORD');
    }
    return null;
  }
  if (!password) {
    throw new Error('Missing AUTOSCORE_PASSWORD (set AUTOSCORE_AUTH=off to run without a password)');
  }
  if (password.trim() === EXAMPLE_PASSWORD) {
    throw new Error('Invalid AUTOSCORE_PASSWORD: replace the example value from deploy/autoscore.env.example');
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
