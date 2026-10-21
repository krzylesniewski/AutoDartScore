import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { migrateToLatest, openDatabase } from './db/index.js';

const config = loadConfig(process.env);
const db = openDatabase(config.databasePath);
await migrateToLatest(db);
const app = await buildApp({
  db,
  logger: true,
  auth: config.auth,
  corsOrigins: config.corsOrigins,
  webDir: config.webDir,
  matchLockMinutes: config.matchLockMinutes,
});

async function shutdown(): Promise<void> {
  await app.close();
  await db.destroy();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

await app.listen({ host: config.host, port: config.port });
