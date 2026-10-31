import { DEFAULT_CAMERA_ID } from '@autoscore/schema';
import { createApiClient } from './api-client.js';
import { runCamera, type RunSummary } from './camera-runner.js';
import type { CameraSource } from './camera-source.js';
import { createCameraSource, loadConfig } from './config.js';
import { DETECTORS } from './detectors.js';

// Ctrl+C w terminalu trafia też do ffmpeg, który może skończyć się błędem chwilę przed obsługą sygnału w Node.
const STOP_GRACE_MS = 250;

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const camera = createCameraSource(config);
  const detector = DETECTORS[config.detector];
  if (detector === undefined) {
    throw new Error(`Invalid AUTOSCORE_DETECTOR: ${JSON.stringify(config.detector)}`);
  }

  let stopping = false;
  const stop = (): void => {
    stopping = true;
    void camera.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const source: CameraSource = {
    async *frames() {
      try {
        yield* camera.frames();
      } catch (error) {
        if (!stopping) {
          await new Promise((resolve) => setTimeout(resolve, STOP_GRACE_MS));
        }
        if (!stopping) {
          throw error;
        }
      }
    },
    close: () => camera.close(),
  };

  const client = createApiClient({ api: config.api });
  const calibration = await client.getCalibration(DEFAULT_CAMERA_ID);
  if (calibration === null) {
    console.log(`Brak kalibracji kamery ${DEFAULT_CAMERA_ID}, detektor dostanie null`);
  } else {
    console.log(`Kalibracja ${DEFAULT_CAMERA_ID}: ${calibration.imageWidth}x${calibration.imageHeight}. Po nowej kalibracji uruchom start ponownie.`);
  }
  const input = config.camera.kind === 'video' ? `nagranie ${config.camera.path}` : `kamera ${config.camera.name}`;
  console.log(`Start: ${input}, detektor ${detector.name}, serwer ${config.api.url}, klatki w ${config.framesDir}`);

  const summary = await runCamera({
    source,
    detector,
    calibration,
    client,
    framesDir: config.framesDir,
    pendingConfidence: config.pendingConfidence,
    log: console,
  });
  console.log(formatSummary(summary));
}

function formatSummary({ sent, rejected, failed, skippedNoMatch, removals }: RunSummary): string {
  return `Koniec: wysłane ${sent}, odrzucone ${rejected}, nieudane ${failed}, bez gry ${skippedNoMatch}, wyjmowanie lotek ${removals}`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
