import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DEFAULT_CAMERA_ID, type CameraCalibration, type HitEvent, type HitReview, type ReviewFrames } from '@autoscore/schema';
import { pickActiveMatch } from './active-match.js';
import type { ApiClient } from './api-client.js';
import type { CameraSource } from './camera-source.js';
import { createDartWatcher, type DartWatcherOptions } from './dart-watcher.js';
import type { Detection, Detector } from './detector.js';
import { hitLabel, isPending } from './evaluation.js';
import { saveDartFrames } from './frame-store.js';
import type { Frame } from './frame.js';

const MAX_CANDIDATES = 10;

export interface RunCameraOptions {
  readonly source: CameraSource;
  readonly detector: Detector;
  readonly calibration: CameraCalibration | null;
  readonly client: Pick<ApiClient, 'listUnfinishedMatches' | 'sendHit'>;
  readonly framesDir: string;
  readonly pendingConfidence: number;
  readonly log: Pick<Console, 'log' | 'error'>;
  readonly now?: () => Date;
  readonly newEventId?: () => string;
  readonly watcher?: DartWatcherOptions;
}

export interface RunSummary {
  readonly sent: number;
  readonly rejected: number;
  readonly failed: number;
  readonly skippedNoMatch: number;
  readonly removals: number;
}

type DartDetection = Extract<Detection, { kind: 'dart' }>;

// Pętla trwa, dopóki źródło daje klatki. Błąd źródła albo detektora kończy ją, a błąd API tylko pomija lotkę.
export async function runCamera(options: RunCameraOptions): Promise<RunSummary> {
  const { source, detector, calibration, client, framesDir, pendingConfidence, log } = options;
  const now = options.now ?? (() => new Date());
  const newEventId = options.newEventId ?? randomUUID;
  const watcher = createDartWatcher(options.watcher);
  const summary = { sent: 0, rejected: 0, failed: 0, skippedNoMatch: 0, removals: 0 };
  let sequence = 0;

  async function handleDart(detection: DartDetection, before: Frame, after: Frame): Promise<void> {
    let matchId: string;
    try {
      const match = pickActiveMatch(await client.listUnfinishedMatches());
      if (match === null) {
        summary.skippedNoMatch++;
        log.log('Brak gry w trakcie, lotka nie została wysłana');
        return;
      }
      matchId = match.id;
    } catch (error) {
      summary.failed++;
      log.error(`Nie udało się pobrać listy gier, lotka nie została wysłana: ${messageOf(error)}`);
      return;
    }

    const eventId = newEventId();
    const hit = detection.hit ?? { segment: 0, multiplier: 0 };
    const event: HitEvent = {
      eventId,
      matchId,
      source: DEFAULT_CAMERA_ID,
      sequence: sequence++,
      segment: hit.segment,
      multiplier: hit.multiplier,
      confidence: detection.hit === null ? 0 : detection.confidence,
      detectedAt: now().toISOString(),
    };
    const uncertain = isPending(detection, pendingConfidence);
    let frames: ReviewFrames | null = null;
    if (uncertain) {
      try {
        frames = await saveDartFrames({ framesDir, matchId, eventId, before, after });
      } catch (error) {
        log.error(`Nie udało się zapisać klatek lotki ${eventId}: ${messageOf(error)}`);
      }
    }
    const hitEvent: HitEvent = uncertain ? { ...event, review: review(detection, frames) } : event;

    const label = detection.hit === null ? 'brak odczytu' : hitLabel(detection.hit);
    try {
      const result = await client.sendHit(hitEvent);
      if (!result.ok) {
        summary.rejected++;
        log.error(`Serwer odrzucił lotkę ${label} (gra ${matchId}): ${result.status}${result.error === null ? '' : ` ${result.error}`}`);
        return;
      }
      summary.sent++;
      const where = frames === null ? '' : `, klatki: ${path.dirname(path.join(framesDir, frames.before))}`;
      const pending = uncertain ? ', do potwierdzenia' : '';
      log.log(`Lotka ${label}, pewność ${hitEvent.confidence.toFixed(2)}${pending}, gra ${matchId}${where}`);
    } catch (error) {
      summary.failed++;
      log.error(`Nie udało się wysłać lotki ${eventId}: ${messageOf(error)}`);
    }
  }

  try {
    for await (const frame of source.frames()) {
      const event = watcher.push(frame);
      if (event === null) {
        continue;
      }
      if (event.kind === 'removal') {
        summary.removals++;
        log.log(`Wyjmowanie lotek (ruch ${(event.motionMs / 1000).toFixed(1)} s), nowa klatka odniesienia`);
        continue;
      }
      const detection = await detector.detect({ before: event.before, after: event.after, calibration });
      if (detection.kind === 'removal') {
        log.log('Detektor rozpoznał wyjmowanie lotek, nic nie wysłano');
        continue;
      }
      if (detection.kind === 'dart') {
        await handleDart(detection, event.before, event.after);
      }
    }
  } finally {
    await source.close();
  }
  return summary;
}

function review(detection: DartDetection, frames: ReviewFrames | null): HitReview {
  const candidates = [...detection.candidates]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, MAX_CANDIDATES)
    .map(({ segment, multiplier, probability }) => ({ segment, multiplier, probability }));
  return frames === null ? { reason: 'low_confidence', candidates } : { reason: 'low_confidence', candidates, frames };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
