import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { qrPath } from './qr-path';

const URL = 'http://192.168.1.20:5173/#/t/t1';

describe('qrPath', () => {
  it('has the size of the encoded code with the quiet zone', () => {
    const encoded = encode(URL, { ecc: 'M', border: 4 });
    expect(qrPath(URL).size).toBe(encoded.size);
    expect(encoded.data[4]?.[4]).toBe(true);
  });

  it('starts with the top row of the finder pattern at (4, 4)', () => {
    // Wzorzec wyszukiwania ma 7 ciemnych modułów w górnym wierszu, a za nim jasny separator.
    expect(qrPath(URL).path.startsWith('M4 4h7v1h-7z')).toBe(true);
  });

  it('leaves the quiet zone empty', () => {
    const { size, path } = qrPath(URL);
    const starts = [...path.matchAll(/M(\d+) (\d+)h(\d+)/g)].map((match) => match.slice(1).map(Number));
    expect(starts.length).toBeGreaterThan(0);
    for (const [x = 0, y = 0, run = 0] of starts) {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(x + run).toBeLessThanOrEqual(size - 4);
      expect(y).toBeLessThan(size - 4);
    }
  });

  it('gives the same path for the same input', () => {
    expect(qrPath(URL)).toEqual(qrPath(URL));
    expect(qrPath(URL).path).not.toBe(qrPath(`${URL}2`).path);
  });
});
