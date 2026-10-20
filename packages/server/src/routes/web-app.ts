import { constants } from 'node:fs';
import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

export interface WebAppOptions {
  readonly webDir: string;
  readonly webRoutes: Set<string>; // trasy bez tokenu, czyta je hak autoryzacji
  readonly apiSegments: ReadonlySet<string>; // pierwsze segmenty tras API zebrane przez onRoute
}

// ':' i '*' to składnia routera, więc plik z takim znakiem zmieniłby się w trasę parametryczną.
const SAFE_URL_PATH = /^[A-Za-z0-9._~/-]+$/;

export function firstSegment(url: string): string {
  return url.split('/')[1] ?? '';
}

function cacheControl(urlPath: string): string {
  if (urlPath.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  if (urlPath.startsWith('/audio/')) {
    return 'public, max-age=604800';
  }
  return 'no-cache';
}

async function isReadableFile(file: string): Promise<boolean> {
  try {
    await access(file, constants.R_OK);
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const urlPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(dir, entry.name), urlPath)));
    } else if (entry.isFile()) {
      files.push(urlPath);
    }
  }
  return files;
}

// Lista plików powstaje raz przy starcie. Wdrożenie restartuje usługę po buildzie frontu.
export async function webAppRoutes(app: FastifyInstance, { webDir, webRoutes, apiSegments }: WebAppOptions): Promise<void> {
  if (!(await isReadableFile(path.join(webDir, 'index.html')))) {
    throw new Error(`Missing index.html in AUTOSCORE_WEB_DIR: ${webDir}`);
  }
  // Kopia, bo onRoute dopisuje też segmenty tras deklarowanych niżej.
  const reserved = new Set(apiSegments);
  const files = (await listFiles(webDir)).filter((urlPath) => {
    if (!SAFE_URL_PATH.test(urlPath)) {
      app.log.warn(`Skipping web file with unsupported characters: ${urlPath}`);
      return false;
    }
    if (reserved.has(firstSegment(urlPath))) {
      app.log.warn(`Skipping web file shadowed by an API route: ${urlPath}`);
      return false;
    }
    return true;
  });

  await app.register(fastifyStatic, { root: webDir, serve: false, cacheControl: false });

  const serve = (url: string, file: string): void => {
    webRoutes.add(url);
    app.get(url, async (_request, reply) => reply.header('cache-control', cacheControl(url)).sendFile(file));
  };
  serve('/', 'index.html');
  for (const urlPath of files) {
    serve(urlPath, urlPath.slice(1));
  }
}
