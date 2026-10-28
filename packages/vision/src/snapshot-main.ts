import { DEFAULT_CAMERA_ID } from '@autoscore/schema';
import { createCameraSource, loadConfig } from './config.js';
import { encodeJpegFrame } from './jpeg-frame.js';
import { captureFrame, sendSnapshot } from './snapshot.js';

// Nagranie nie ma ciemnych klatek na starcie, więc bierze pierwszą.
const LIVE_SETTLE_MS = 2000;

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const source = createCameraSource(config);
  const frame = await captureFrame(source, { settleMs: config.camera.kind === 'avfoundation' ? LIVE_SETTLE_MS : 0 });
  const jpeg = encodeJpegFrame(frame);
  await sendSnapshot({ api: config.api, cameraId: DEFAULT_CAMERA_ID, jpeg });
  console.log(`Snapshot sent to ${config.api.url}: ${frame.width}x${frame.height}, ${jpeg.length} bytes`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
