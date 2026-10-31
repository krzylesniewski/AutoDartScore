import type { Frame } from './frame.js';

// Kontrakt wszystkich źródeł: proces rusza dopiero z iteracją, frames() działa tylko raz,
// close() i przerwanie pętli zatrzymują proces, a close() kończy trwającą iterację bez błędu.
export interface CameraSource {
  frames(): AsyncIterable<Frame>;
  close(): Promise<void>;
}
