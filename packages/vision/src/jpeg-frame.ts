import { readFile } from 'node:fs/promises';
import { decode, encode } from 'jpeg-js';
import { FRAME_BYTES_PER_PIXEL, type Frame } from './frame.js';

// Czysty JS zamiast natywnych bindingów, żeby testy na klatkach z /fixtures działały wszędzie tak samo.
export async function readJpegFrame(filePath: string, timestamp = 0): Promise<Frame> {
  try {
    const buffer = await readFile(filePath);
    const image = decode(buffer, { useTArray: true, formatAsRGBA: false });
    if (image.data.length !== image.width * image.height * FRAME_BYTES_PER_PIXEL) {
      throw new Error(`decoded ${image.data.length} bytes for ${image.width}x${image.height}, expected RGB24`);
    }
    return { width: image.width, height: image.height, data: image.data, timestamp };
  } catch (error) {
    throw new Error(`Cannot read JPEG ${filePath}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

// jpeg-js koduje tylko RGBA, więc klatka RGB24 dostaje kanał alfa 255.
export function encodeJpegFrame(frame: Frame, quality = 90): Uint8Array {
  const { width, height, data } = frame;
  if (data.length !== width * height * FRAME_BYTES_PER_PIXEL) {
    throw new Error(`Frame has ${data.length} bytes for ${width}x${height}, expected RGB24`);
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0, from = 0, to = 0; pixel < width * height; pixel += 1, from += 3, to += 4) {
    rgba[to] = data[from] ?? 0;
    rgba[to + 1] = data[from + 1] ?? 0;
    rgba[to + 2] = data[from + 2] ?? 0;
    rgba[to + 3] = 255;
  }
  const { data: jpeg } = encode({ width, height, data: rgba }, quality);
  return new Uint8Array(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
}
