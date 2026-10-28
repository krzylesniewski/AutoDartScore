import { readFile } from 'node:fs/promises';
import { decode } from 'jpeg-js';
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
