export const FRAME_BYTES_PER_PIXEL = 3;

export interface Frame {
  readonly width: number;
  readonly height: number;
  // RGB24: 3 bajty na piksel, wiersze od lewego górnego rogu, bez wyrównania, długość width * height * 3.
  readonly data: Uint8Array;
  // ms. Źródło z pliku: pts klatki. Źródło na żywo: czas monotoniczny od uruchomienia ffmpeg.
  readonly timestamp: number;
}
