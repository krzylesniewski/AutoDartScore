import { baselineDetector } from './baseline-detector.js';
import type { Detector } from './detector.js';

export const DETECTORS: Readonly<Record<string, Detector>> = { baseline: baselineDetector };
