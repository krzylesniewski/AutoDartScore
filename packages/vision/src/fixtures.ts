import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { CameraCalibration, Hit } from '@autoscore/schema';
import { z } from 'zod';
import type { Frame } from './frame.js';
import { readJpegFrame } from './jpeg-frame.js';

const LABELS_FILE = 'labels.json';
const CALIBRATION_FILE = 'calibration.json';

// Format narzędziowy zestawu testowego, a nie DTO API, więc żyje w vision, a nie w schema.
const FrameFileName = z
  .string()
  .min(1)
  .refine((name) => !name.includes('/') && !name.includes('\\') && !name.includes('..'), {
    message: 'Frame must be a plain file name in the session directory',
  });

// safeExtend zachowuje refine z Hit, więc 25×3 i 0×1 nie przejdą.
export const ExpectedEvent = z.discriminatedUnion('kind', [
  Hit.safeExtend({
    kind: z.literal('dart'),
    turn: z.int().min(1).optional(),
    comment: z.string().optional(),
  }),
  z.object({ kind: z.literal('removal') }),
  z.object({ kind: z.literal('none') }),
]);
export type ExpectedEvent = z.infer<typeof ExpectedEvent>;

export const FixtureLabels = z.object({
  session: z.string().min(1),
  recordedAt: z.string().optional(),
  camera: z.string().optional(),
  note: z.string().optional(),
  events: z
    .array(
      z.object({
        id: z.string().min(1),
        afterTime: z.number().min(0).optional(),
        before: FrameFileName,
        after: FrameFileName,
        expected: ExpectedEvent,
        comment: z.string().optional(),
      }),
    )
    .min(1)
    .superRefine((events, ctx) => {
      const seen = new Set<string>();
      events.forEach(({ id }, index) => {
        if (seen.has(id)) {
          ctx.addIssue({ code: 'custom', message: `Duplicate event id ${JSON.stringify(id)}`, path: [index, 'id'] });
        }
        seen.add(id);
      });
    }),
});
export type FixtureLabels = z.infer<typeof FixtureLabels>;

export interface FixtureEvent {
  readonly id: string;
  readonly expected: ExpectedEvent;
  readonly beforePath: string;
  readonly afterPath: string;
  readonly afterTime?: number;
}

export interface FixtureSession {
  readonly name: string;
  readonly dir: string;
  readonly events: readonly FixtureEvent[];
  readonly calibration: CameraCalibration | null;
}

export async function loadFixtureSession(dir: string): Promise<FixtureSession> {
  const sessionDir = resolve(dir);
  const name = basename(sessionDir);
  const labelsPath = join(sessionDir, LABELS_FILE);
  const labels = parseFile(labelsPath, FixtureLabels, await readJson(labelsPath));
  if (labels.session !== name) {
    throw invalidFile(labelsPath, `Session ${JSON.stringify(labels.session)} does not match directory ${JSON.stringify(name)}`, [
      'session',
    ]);
  }

  const events: FixtureEvent[] = [];
  for (const [index, event] of labels.events.entries()) {
    const beforePath = join(sessionDir, event.before);
    const afterPath = join(sessionDir, event.after);
    await requireFile(labelsPath, beforePath, ['events', index, 'before']);
    await requireFile(labelsPath, afterPath, ['events', index, 'after']);
    events.push({
      id: event.id,
      expected: event.expected,
      beforePath,
      afterPath,
      ...(event.afterTime === undefined ? {} : { afterTime: event.afterTime }),
    });
  }

  return { name, dir: sessionDir, events, calibration: await loadCalibration(join(sessionDir, CALIBRATION_FILE)) };
}

export async function loadFixtureSessions(fixturesDir: string): Promise<FixtureSession[]> {
  const root = resolve(fixturesDir);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Cannot read fixtures directory ${root}: ${errorMessage(error)}`, { cause: error });
  }
  // Porównanie bez locale, żeby kolejność sesji była taka sama na każdej maszynie.
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const sessions: FixtureSession[] = [];
  for (const name of names) {
    if (await isFile(join(root, name, LABELS_FILE))) {
      sessions.push(await loadFixtureSession(join(root, name)));
    }
  }
  if (sessions.length === 0) {
    throw new Error(`No fixture sessions in ${root}: no subdirectory has ${LABELS_FILE}`);
  }
  return sessions;
}

// Klatka ma około 6 MB, więc dekodujemy dopiero tutaj, a nie przy wczytaniu sesji.
export async function loadEventFrames(event: FixtureEvent): Promise<{ before: Frame; after: Frame }> {
  return { before: await readJpegFrame(event.beforePath), after: await readJpegFrame(event.afterPath) };
}

async function loadCalibration(path: string): Promise<CameraCalibration | null> {
  if (!(await isFile(path))) {
    return null;
  }
  return parseFile(path, CameraCalibration, await readJson(path));
}

async function readJson(path: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${path}: ${errorMessage(error)}`, { cause: error });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${errorMessage(error)}`, { cause: error });
  }
}

function parseFile<T extends z.ZodType>(path: string, schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

async function requireFile(labelsPath: string, path: string, field: PropertyKey[]): Promise<void> {
  if (!(await isFile(path))) {
    throw invalidFile(labelsPath, `Frame file not found: ${path}`, field);
  }
}

// Ten sam format co błędy Zod, żeby ścieżka pola wyglądała wszędzie tak samo.
function invalidFile(path: string, message: string, field: PropertyKey[]): Error {
  const error = new z.ZodError([{ code: 'custom', message, path: field, input: undefined }]);
  return new Error(`Invalid ${path}:\n${z.prettifyError(error)}`);
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw new Error(`Cannot read ${path}: ${errorMessage(error)}`, { cause: error });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
