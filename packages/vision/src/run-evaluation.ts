import { Hit } from '@autoscore/schema';
import { z } from 'zod';
import type { Detection, Detector } from './detector.js';
import { summarize } from './evaluation.js';
import type { EvaluationReport, EventResult } from './evaluation.js';
import { loadEventFrames } from './fixtures.js';
import type { FixtureEvent, FixtureSession } from './fixtures.js';

const Probability = z.number().min(0).max(1);

// Detektor to kod spoza kontraktu API, więc jego wynik sprawdzamy przed oceną.
const DetectionResult = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dart'),
    hit: Hit.nullable(),
    confidence: Probability,
    candidates: z.array(Hit.safeExtend({ probability: Probability })),
  }),
  z.object({ kind: z.literal('removal') }),
  z.object({ kind: z.literal('none') }),
]);

export async function runEvaluation(
  sessions: readonly FixtureSession[],
  detector: Detector,
  options: { readonly threshold: number },
): Promise<EvaluationReport> {
  const results: EventResult[] = [];
  // Po jednym zdarzeniu naraz: każda klatka ma około 6 MB.
  for (const session of sessions) {
    for (const event of session.events) {
      try {
        results.push({
          session: session.name,
          calibrated: session.calibration !== null,
          id: event.id,
          expected: event.expected,
          detection: await detectEvent(session, event, detector),
        });
      } catch (error) {
        throw new Error(
          `Session ${session.name}, event ${event.id}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    }
  }
  return summarize(results, { detector: detector.name, threshold: options.threshold });
}

async function detectEvent(session: FixtureSession, event: FixtureEvent, detector: Detector): Promise<Detection> {
  const { before, after } = await loadEventFrames(event);
  const { calibration } = session;
  if (calibration !== null) {
    for (const frame of [before, after]) {
      if (frame.width !== calibration.imageWidth || frame.height !== calibration.imageHeight) {
        throw new Error(
          `Frame ${frame.width}x${frame.height} does not match calibration ` +
            `${calibration.imageWidth}x${calibration.imageHeight}`,
        );
      }
    }
  }
  const result = DetectionResult.safeParse(await detector.detect({ before, after, calibration }));
  if (!result.success) {
    throw new Error(`Invalid detection from ${detector.name}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
