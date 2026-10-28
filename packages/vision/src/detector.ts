import type { CameraCalibration, Hit } from '@autoscore/schema';
import type { Frame } from './frame.js';

// Ten sam płaski kształt co review.candidates w kontrakcie projektu.
export type DetectionCandidate = Hit & { readonly probability: number };

// hit: null to brak odczytu segmentu. Taka lotka zawsze trafia do potwierdzenia.
export type Detection =
  | {
      readonly kind: 'dart';
      readonly hit: Hit | null;
      readonly confidence: number;
      readonly candidates: readonly DetectionCandidate[];
    }
  | { readonly kind: 'removal' }
  | { readonly kind: 'none' };

export interface DetectorInput {
  readonly before: Frame;
  readonly after: Frame;
  readonly calibration: CameraCalibration | null;
}

export interface Detector {
  readonly name: string;
  detect(input: DetectorInput): Promise<Detection>;
}
