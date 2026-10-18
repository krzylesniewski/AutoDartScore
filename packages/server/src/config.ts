export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    // 0.0.0.0, żeby tablet w sieci lokalnej mógł się połączyć.
    host: env.HOST || '0.0.0.0',
    port: parsePort(env.PORT),
    databasePath: env.DATABASE_PATH || 'autoscore.sqlite',
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
