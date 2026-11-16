import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { PASSWORD, TOKEN_SECRET } from './env';

const PORT = 3210;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WEB_DIR = path.join(import.meta.dirname, 'dist', 'web');

// Runner i każdy worker wczytują konfigurację osobno. Workery dziedziczą env runnera, więc katalog bazy powstaje raz.
const DATA_DIR_ENV = 'AUTOSCORE_E2E_DATA_DIR';
const dataDir = (process.env[DATA_DIR_ENV] ??= fs.mkdtempSync(path.join(os.tmpdir(), 'autoscore-e2e-')));

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: 'dist/test-results',
  // Specy dzielą jeden serwer i jedną bazę.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    // Zamiana wierszy paska wyników nie animuje się w trakcie pomiaru pudełek.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Serwer czyta listę plików frontu raz przy starcie, więc build musi być gotowy wcześniej.
    command: `pnpm --filter @autoscore/web build --outDir ${JSON.stringify(WEB_DIR)} --emptyOutDir && pnpm --filter @autoscore/server start`,
    url: `${BASE_URL}/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    // Playwright nakłada te zmienne na process.env, więc każda jest ustawiona jawnie, także pusta.
    env: {
      VITE_BASE: '/',
      VITE_API_URL: BASE_URL,
      HOST: '127.0.0.1',
      PORT: String(PORT),
      AUTOSCORE_AUTH: 'on',
      AUTOSCORE_PASSWORD: PASSWORD,
      AUTOSCORE_TOKEN_SECRET: TOKEN_SECRET,
      AUTOSCORE_WEB_DIR: WEB_DIR,
      DATABASE_PATH: path.join(dataDir, 'autoscore.sqlite'),
      // Przed serwerem nie ma proxy, inaczej niż na produkcji.
      AUTOSCORE_TRUST_PROXY: 'off',
      AUTOSCORE_CORS_ORIGIN: '',
      AUTOSCORE_MATCH_LOCK_MINUTES: '',
    },
  },
});
