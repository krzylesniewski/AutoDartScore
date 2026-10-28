import type { Detection, Detector } from './detector.js';
import { FRAME_BYTES_PER_PIXEL, type Frame } from './frame.js';

// Progi ze spike'a spikes/camera/detect-events.mjs. Analiza w 320×180 i w odcieniach szarości
// wystarcza do wykrycia zmiany, a jest tania.
const ANALYSIS_WIDTH = 320;
const ANALYSIS_HEIGHT = 180;
const PIXEL_THRESHOLD = 25;
const MIN_EVENT_CHANGE = 0.0005;
const LARGE_CHANGE = 0.03;
const CELL = 20;
const CELL_ACTIVE = 0.05;
const GLOBAL_SPREAD = 0.12;
const MIN_ACTIVE_CELLS = 2;

const CELL_COLUMNS = ANALYSIS_WIDTH / CELL;
const CELL_ROWS = ANALYSIS_HEIGHT / CELL;

export interface FrameChange {
  readonly changedFraction: number;
  readonly activeCells: number;
  readonly spread: number;
}

export function measureChange(before: Frame, after: Frame): FrameChange {
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error(`Frame sizes differ: ${before.width}x${before.height} and ${after.width}x${after.height}`);
  }
  if (before.width < ANALYSIS_WIDTH || before.height < ANALYSIS_HEIGHT) {
    throw new Error(`Frame ${before.width}x${before.height} is smaller than ${ANALYSIS_WIDTH}x${ANALYSIS_HEIGHT}`);
  }
  const a = downscaledLuma(before);
  const b = downscaledLuma(after);

  let changed = 0;
  let activeCells = 0;
  for (let cy = 0; cy < CELL_ROWS; cy++) {
    for (let cx = 0; cx < CELL_COLUMNS; cx++) {
      let cellChanged = 0;
      for (let y = cy * CELL; y < (cy + 1) * CELL; y++) {
        for (let x = cx * CELL; x < (cx + 1) * CELL; x++) {
          const i = y * ANALYSIS_WIDTH + x;
          if (Math.abs((a[i] ?? 0) - (b[i] ?? 0)) > PIXEL_THRESHOLD) {
            cellChanged++;
          }
        }
      }
      changed += cellChanged;
      if (cellChanged / (CELL * CELL) > CELL_ACTIVE) {
        activeCells++;
      }
    }
  }
  return {
    changedFraction: changed / (ANALYSIS_WIDTH * ANALYSIS_HEIGHT),
    activeCells,
    spread: activeCells / (CELL_COLUMNS * CELL_ROWS),
  };
}

// Lotka zmienia obraz w jednym miejscu, a ekspozycja i autofocus w całym kadrze.
export const baselineDetector: Detector = {
  name: 'baseline',
  detect({ before, after }): Promise<Detection> {
    // Para klatek nie mówi, jak długo trwał ruch, a tylko po tym spike odróżniał wyjmowanie lotek.
    // Dlatego baseline nigdy nie zwraca removal.
    const { changedFraction, activeCells, spread } = measureChange(before, after);
    if (changedFraction < MIN_EVENT_CHANGE) {
      return Promise.resolve({ kind: 'none' });
    }
    if (spread > GLOBAL_SPREAD || changedFraction > LARGE_CHANGE) {
      return Promise.resolve({ kind: 'none' });
    }
    if (activeCells < MIN_ACTIVE_CELLS) {
      return Promise.resolve({ kind: 'none' });
    }
    return Promise.resolve({ kind: 'dart', hit: null, confidence: 0, candidates: [] });
  },
};

// Średnia luma z bloku źródłowego [floor(x*w/320), floor((x+1)*w/320)), bez zaokrągleń.
function downscaledLuma(frame: Frame): Float64Array {
  const { width, height, data } = frame;
  const sums = new Float64Array(ANALYSIS_WIDTH * ANALYSIS_HEIGHT);
  const columns = blockIndices(width, ANALYSIS_WIDTH);
  const rows = blockIndices(height, ANALYSIS_HEIGHT);
  for (let y = 0; y < height; y++) {
    const rowOffset = (rows[y] ?? 0) * ANALYSIS_WIDTH;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * FRAME_BYTES_PER_PIXEL;
      const luma = 0.299 * (data[p] ?? 0) + 0.587 * (data[p + 1] ?? 0) + 0.114 * (data[p + 2] ?? 0);
      const i = rowOffset + (columns[x] ?? 0);
      sums[i] = (sums[i] ?? 0) + luma;
    }
  }
  const columnSizes = blockSizes(width, ANALYSIS_WIDTH);
  const rowSizes = blockSizes(height, ANALYSIS_HEIGHT);
  for (let y = 0; y < ANALYSIS_HEIGHT; y++) {
    for (let x = 0; x < ANALYSIS_WIDTH; x++) {
      const i = y * ANALYSIS_WIDTH + x;
      sums[i] = (sums[i] ?? 0) / ((rowSizes[y] ?? 1) * (columnSizes[x] ?? 1));
    }
  }
  return sums;
}

// Indeks bloku wyjściowego dla każdej współrzędnej źródłowej.
function blockIndices(source: number, target: number): Uint16Array {
  const indices = new Uint16Array(source);
  for (let t = 0; t < target; t++) {
    indices.fill(t, Math.floor((t * source) / target), Math.floor(((t + 1) * source) / target));
  }
  return indices;
}

function blockSizes(source: number, target: number): Uint32Array {
  const sizes = new Uint32Array(target);
  for (let t = 0; t < target; t++) {
    sizes[t] = Math.floor(((t + 1) * source) / target) - Math.floor((t * source) / target);
  }
  return sizes;
}
