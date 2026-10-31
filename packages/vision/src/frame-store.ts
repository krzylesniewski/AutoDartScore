import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ReviewFrames } from '@autoscore/schema';
import type { Frame } from './frame.js';
import { encodeJpegFrame } from './jpeg-frame.js';

export interface SaveDartFramesOptions {
  readonly framesDir: string;
  readonly matchId: string;
  readonly eventId: string;
  readonly before: Frame;
  readonly after: Frame;
}

// Ścieżki w review.frames są względne wobec framesDir, z ukośnikami niezależnie od systemu.
export async function saveDartFrames({ framesDir, matchId, eventId, before, after }: SaveDartFramesOptions): Promise<ReviewFrames> {
  const frames = ReviewFrames.parse({
    before: `${matchId}/${eventId}-before.jpg`,
    after: `${matchId}/${eventId}-after.jpg`,
  });
  await mkdir(path.join(framesDir, matchId), { recursive: true });
  await writeFile(path.join(framesDir, ...frames.before.split('/')), encodeJpegFrame(before));
  await writeFile(path.join(framesDir, ...frames.after.split('/')), encodeJpegFrame(after));
  return frames;
}
